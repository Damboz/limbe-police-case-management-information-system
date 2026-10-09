const db = require('../config/db');
const { syncCaseInvestigators } = require('./assignmentService');
const { OVERDUE_DAYS_THRESHOLD } = require('./caseService');
const { ok, fail } = require('../utils/result');

const COMMANDER_ROLES = ['Station Commander', 'supervisor'];


async function getDashboard() {
    const [[kpiCounts]] = await db.execute(`
        SELECT
            (SELECT COUNT(*) FROM cases c
                WHERE NOT EXISTS (SELECT 1 FROM case_investigators ci WHERE ci.case_id = c.id)
                  AND c.status != 'Closed')                                       AS unassigned_count,
            (SELECT COUNT(*) FROM cases
                WHERE requested_status IS NOT NULL AND branch_review_status = 'Recommended') AS pending_approvals_count,
            (SELECT COUNT(*) FROM cases WHERE status = 'Under Investigation')      AS active_cases_count,
            (SELECT COUNT(*) FROM cases
                WHERE status = 'Under Investigation'
                  AND CURRENT_DATE - created_at::date > ${OVERDUE_DAYS_THRESHOLD})  AS overdue_count,
            (SELECT COUNT(*) FROM reassignment_proposals WHERE status = 'Pending') AS pending_reassignments_count,
            (SELECT COUNT(*) FROM cases
                WHERE prosecution_query IS NOT NULL AND prosecution_query_resolved_at IS NULL) AS open_queries_count
    `);

    const [unassignedCases] = await db.execute(`
        SELECT 
            c.id, 
            c.ob_number AS case_number, 
            c.incident_details AS title, 
            cc.name AS crime_category, 
            c.priority, 
            c.created_at,
            CONCAT(u.first_name, ' ', u.last_name) AS registered_by_officer
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN users u ON c.intake_officer_id = u.id
        WHERE NOT EXISTS (SELECT 1 FROM case_investigators ci WHERE ci.case_id = c.id)
          AND c.status != 'Closed'
        ORDER BY CASE c.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END, c.created_at ASC
        LIMIT 10
    `);

    const [pendingApprovals] = await db.execute(`
        SELECT 
            c.id, 
            c.ob_number AS case_number, 
            c.incident_details AS title, 
            c.requested_status,
            c.requested_status AS requested_target,
            c.status_request_notes,
            c.status_requested_at,
            c.branch_reviewed_at,
            CONCAT(branch.rank_title, ' ', branch.last_name) AS branch_reviewer_name,
            CONCAT(inv.rank_title, ' ', inv.last_name) AS investigator_name
        FROM cases c
        LEFT JOIN case_investigators cil ON c.id = cil.case_id AND cil.is_lead = 1
        LEFT JOIN users inv ON cil.investigator_id = inv.id
        LEFT JOIN users branch ON c.branch_reviewed_by = branch.id
        WHERE c.requested_status IS NOT NULL AND c.branch_review_status = 'Recommended'
        ORDER BY c.branch_reviewed_at ASC
    `);

    const [pendingReassignments] = await db.execute(`
        SELECT 
            rp.id AS proposal_id,
            c.id AS case_id,
            c.ob_number AS case_number,
            c.incident_details AS title,
            cc.name AS crime_category,
            rp.current_investigator_id,
            CONCAT(cur.rank_title, ' ', cur.first_name, ' ', cur.last_name) AS current_investigator_name,
            rp.proposed_investigator_id,
            CONCAT(pro.rank_title, ' ', pro.first_name, ' ', pro.last_name) AS proposed_investigator_name,
            CONCAT(pb.rank_title, ' ', pb.first_name, ' ', pb.last_name) AS proposed_by_name,
            rp.reason,
            rp.created_at
        FROM reassignment_proposals rp
        JOIN cases c ON rp.case_id = c.id
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN users cur ON rp.current_investigator_id = cur.id
        JOIN users pro ON rp.proposed_investigator_id = pro.id
        JOIN users pb ON rp.proposed_by = pb.id
        WHERE rp.status = 'Pending'
        ORDER BY rp.created_at ASC
    `);

    const [prosecutionQueries] = await db.execute(`
        SELECT 
            c.id,
            c.ob_number AS case_number,
            c.incident_details AS title,
            cc.name AS crime_category,
            c.prosecution_query,
            c.prosecution_query_at
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        WHERE c.prosecution_query IS NOT NULL AND c.prosecution_query_resolved_at IS NULL
        ORDER BY c.prosecution_query_at ASC
    `);

    const [investigatorWorkload] = await db.execute(`
        SELECT 
            u.id, 
            u.badge_number, 
            u.rank_title, 
            u.first_name, 
            u.last_name,
            COUNT(DISTINCT c.id) AS active_case_count
        FROM users u
        LEFT JOIN case_investigators ci ON u.id = ci.investigator_id
        LEFT JOIN cases c ON ci.case_id = c.id AND c.status = 'Under Investigation'
        WHERE u.is_active = 1 AND u.role NOT IN ('Admin', 'admin')
        GROUP BY u.id
        ORDER BY active_case_count ASC
    `);

    const [assignedActiveCases] = await db.execute(`
        SELECT 
            c.id, 
            c.ob_number AS case_number, 
            c.incident_details AS title, 
            cc.name AS crime_category, 
            c.priority, 
            c.status, 
            c.created_at,
            CURRENT_DATE - c.created_at::date AS days_open,
            STRING_AGG(inv.id::text, ',' ORDER BY ci.is_lead DESC, inv.last_name) AS investigator_ids,
            STRING_AGG(CONCAT(inv.rank_title, ' ', inv.first_name, ' ', inv.last_name)
                , ', ' ORDER BY ci.is_lead DESC, inv.last_name) AS investigator_names
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        JOIN case_investigators ci ON c.id = ci.case_id
        LEFT JOIN users inv ON ci.investigator_id = inv.id
        WHERE c.status NOT IN ('Closed', 'Archived')
        GROUP BY c.id, cc.name
        ORDER BY days_open DESC
        LIMIT 15
    `);

    return ok({
        kpi: {
            unassigned: kpiCounts.unassigned_count || 0,
            pendingApprovals: kpiCounts.pending_approvals_count || 0,
            activeCases: kpiCounts.active_cases_count || 0,
            overdue: kpiCounts.overdue_count || 0,
            pendingReassignments: kpiCounts.pending_reassignments_count || 0,
            openQueries: kpiCounts.open_queries_count || 0
        },
        overdueDaysThreshold: OVERDUE_DAYS_THRESHOLD,
        unassignedCases,
        pendingApprovals,
        pendingReassignments,
        prosecutionQueries,
        investigatorWorkload,
        assignedActiveCases
    });
}


async function assignCase(user, caseId, investigatorIds, notes) {
    if (!COMMANDER_ROLES.includes(user.role)) {
        return fail(403, 'Only Station Commanders can assign cases to investigators.');
    }

    const rawIds = Array.isArray(investigatorIds) ? investigatorIds : (investigatorIds ? [investigatorIds] : []);
    const ids = [...new Set(rawIds.map(v => String(v)).filter(Boolean))];

    if (!caseId || ids.length === 0) {
        return fail(400, 'Please select a valid case and at least one investigator.');
    }

    const placeholders = ids.map(() => '?').join(',');
    const [inv] = await db.execute(
        `SELECT id, badge_number, rank_title, first_name, last_name 
         FROM users 
         WHERE id IN (${placeholders}) AND is_active = 1 AND role NOT IN ('Admin', 'admin')`,
        ids
    );

    if (inv.length === 0) {
        return fail(400, 'Please select active officers (administrators cannot be assigned as investigators).');
    }

    const [caseRows] = await db.execute('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0) {
        return fail(404, 'Case record not found.');
    }

    const [existing] = await db.execute(
        'SELECT COUNT(*) AS cnt FROM case_investigators WHERE case_id = ?',
        [caseId]
    );
    const hadPrevious = existing[0].cnt > 0;

    await syncCaseInvestigators(caseId, ids, user.id);

    await db.execute(
        `UPDATE cases 
         SET status = 'Under Investigation', updated_at = NOW() 
         WHERE id = ?`,
        [caseId]
    );

    const officerNames = inv.map(i => `${i.rank_title} ${i.last_name} (${i.badge_number})`).join(', ');
    const shortNames = inv.map(i => i.last_name).join(', ');

    return ok({
        caseId,
        hadPrevious,
        auditAction: hadPrevious ? 'CASE_REASSIGNED' : 'CASE_ASSIGNED',
        auditDetails: `${hadPrevious ? 'Updated investigators for' : 'Assigned'} Case ID ${caseId} to Investigator(s): ${officerNames}. ${notes ? 'Note: ' + notes : ''}`,
        message: `Case assigned successfully to Officer(s): ${shortNames}.`
    });
}


async function processStatusApproval(user, caseId, decision, supervisorNotes) {
    if (!COMMANDER_ROLES.includes(user.role)) {
        return fail(403, 'Only Station Officers can approve or reject status change requests.');
    }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
        return fail(400, 'Invalid decision provided.');
    }

    const [caseRows] = await db.execute(`
        SELECT id, ob_number, requested_status, branch_review_status
        FROM cases WHERE id = ?
    `, [caseId]);

    if (caseRows.length === 0 || !caseRows[0].requested_status) {
        return fail(404, 'No pending status change request found for this case.');
    }

    const currentCase = caseRows[0];
    if (currentCase.branch_review_status !== 'Recommended') {
        return fail(403, 'This request has not been reviewed and recommended by the branch in-charge yet.');
    }

    const isForward = currentCase.requested_status === 'Forwarded to Prosecution';
    const targetStatus = decision === 'APPROVE' ? currentCase.requested_status : 'Under Investigation';

    await db.execute(
        `UPDATE cases 
         SET status = ?, requested_status = NULL, status_request_notes = NULL, 
             status_requested_by = NULL, status_requested_at = NULL,
             branch_review_status = NULL, branch_reviewed_by = NULL, branch_reviewed_at = NULL,
             forwarded_at = CASE WHEN ? THEN NOW() ELSE forwarded_at END,
             updated_at = NOW() 
         WHERE id = ?`,
        [targetStatus, isForward, caseId]
    );

    const minuteDecision = decision === 'APPROVE' ? 'Approved' : 'Rejected';

    await db.execute(
        `INSERT INTO case_minutes (case_id, minute_type, author_id, decision, comment)
         VALUES (?, 'COMMANDER_APPROVAL', ?, ?, ?)`,
        [caseId, user.id, minuteDecision, supervisorNotes || null]
    );

    if (decision === 'APPROVE' && isForward) {
        await db.execute(
            `INSERT INTO case_custody_log (case_id, handed_over_by, status, notes)
             VALUES (?, ?, 'Pending', ?)`,
            [caseId, user.id, supervisorNotes || null]
        );
    }

    const decisionVerb = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    return ok({
        caseId,
        obNumber: currentCase.ob_number,
        targetStatus,
        decision,
        auditDetails: `Supervisor ${decisionVerb} status change request for Case OB ${currentCase.ob_number}. New status: ${targetStatus}. ${supervisorNotes ? 'Notes: ' + supervisorNotes : ''}`,
        message: isForward && decision === 'APPROVE'
            ? `Case OB ${currentCase.ob_number} forwarded to the Prosecution Branch for court preparation.`
            : `Case OB ${currentCase.ob_number} status updated to ${targetStatus}.`
    });
}


async function decideReassignment(user, proposalId, decision, decisionNote) {
    if (!COMMANDER_ROLES.includes(user.role)) {
        return fail(403, 'Only Station Officers can decide reassignment proposals.');
    }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
        return fail(400, 'Invalid decision provided.');
    }

    const [proposalRows] = await db.execute(`
        SELECT rp.*, c.ob_number FROM reassignment_proposals rp
        JOIN cases c ON rp.case_id = c.id
        WHERE rp.id = ?
    `, [proposalId]);

    if (proposalRows.length === 0) {
        return fail(404, 'Reassignment proposal not found.');
    }

    const proposal = proposalRows[0];
    if (proposal.status !== 'Pending') {
        return fail(400, 'This reassignment proposal has already been decided.');
    }

    await db.execute(
        `UPDATE reassignment_proposals
         SET status = ?, decided_by = ?, decision_note = ?, decided_at = NOW()
         WHERE id = ?`,
        [decision === 'APPROVE' ? 'Approved' : 'Rejected', user.id, decisionNote || null, proposalId]
    );

    if (decision === 'APPROVE') {
        const current = proposal.current_investigator_id ? String(proposal.current_investigator_id) : null;
        const proposed = String(proposal.proposed_investigator_id);
        const [existing] = await db.execute(
            'SELECT investigator_id FROM case_investigators WHERE case_id = ?',
            [proposal.case_id]
        );
        const team = existing
            .map(row => String(row.investigator_id))
            .filter(id => id !== current);

        if (!team.includes(proposed)) {
            team.push(proposed);
        }

        await syncCaseInvestigators(proposal.case_id, team, user.id);

        await db.execute(
            `UPDATE cases SET status = 'Under Investigation', updated_at = NOW() WHERE id = ?`,
            [proposal.case_id]
        );
    }

    return ok({
        proposalId,
        caseId: proposal.case_id,
        obNumber: proposal.ob_number,
        decision,
        auditDetails: `Station Officer ${decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'} reassignment proposal ${proposalId} for Case OB ${proposal.ob_number}. ${decisionNote ? 'Note: ' + decisionNote : ''}`,
        message: decision === 'APPROVE'
            ? `Reassignment approved and Case OB ${proposal.ob_number} re-assigned.`
            : `Reassignment proposal for Case OB ${proposal.ob_number} rejected.`
    });
}


async function resolveProsecutionQuery(user, caseId, resolution) {
    if (!COMMANDER_ROLES.includes(user.role)) {
        return fail(403, 'Only Station Officers can resolve prosecution queries.');
    }

    if (!resolution || !resolution.trim()) {
        return fail(400, 'A resolution note is required.');
    }

    const [caseRows] = await db.execute(`
        SELECT id, ob_number, prosecution_query FROM cases WHERE id = ?
    `, [caseId]);

    if (caseRows.length === 0 || !caseRows[0].prosecution_query) {
        return fail(404, 'There is no open prosecution query for this case.');
    }

    await db.execute(
        `UPDATE cases SET prosecution_query_resolved_at = NOW() WHERE id = ?`,
        [caseId]
    );

    await db.execute(
        `INSERT INTO case_minutes (case_id, minute_type, author_id, decision, comment)
         VALUES (?, 'COMMANDER_APPROVAL', ?, ?, ?)`,
        [caseId, user.id, 'Approved', 'Query resolved: ' + resolution.trim()]
    );

    return ok({
        caseId,
        auditDetails: `Station Officer resolved prosecution query for Case OB ${caseRows[0].ob_number}: ${resolution.trim()}`,
        message: 'Query marked as resolved and the prosecution branch has been notified.'
    });
}


async function getAnalytics() {
    const [
        [monthlyTrends],
        [categoryBreakdown],
        [hotspots],
        [statusDistribution]
    ] = await Promise.all([
        db.execute(`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM') AS month_key,
                TO_CHAR(created_at, 'Mon YYYY') AS month_label,
                COUNT(*) AS total_cases,
                SUM(CASE WHEN priority IN ('High', 'Critical') THEN 1 ELSE 0 END) AS severe_cases
            FROM cases
            WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY month_key, month_label
            ORDER BY month_key ASC
        `),

        db.execute(`
            SELECT 
                cc.name AS crime_category,
                COUNT(c.id) AS total_incidents,
                ROUND((COUNT(c.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM cases), 0)), 1) AS percentage
            FROM crime_categories cc
            LEFT JOIN cases c ON cc.id = c.category_id
            GROUP BY cc.id, cc.name
            ORDER BY total_incidents DESC
        `),

        db.execute(`
            SELECT 
                incident_location AS location,
                COUNT(*) AS incident_count,
                SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS resolved_count,
                SUM(CASE WHEN status = 'Under Investigation' THEN 1 ELSE 0 END) AS active_count
            FROM cases
            WHERE incident_location IS NOT NULL AND TRIM(incident_location) != ''
            GROUP BY incident_location
            ORDER BY incident_count DESC
            LIMIT 10
        `),

        db.execute(`
            SELECT 
                status,
                COUNT(*) AS total_count
            FROM cases
            GROUP BY status
        `)
    ]);

    const totalCases = statusDistribution.reduce((acc, curr) => acc + curr.total_count, 0);
    const closedCases = statusDistribution.find(s => s.status === 'Closed')?.total_count || 0;
    const resolutionRate = totalCases > 0 ? Number(((closedCases / totalCases) * 100).toFixed(1)) : 0;

    return ok({
        monthlyTrends,
        categoryBreakdown,
        hotspots,
        statusDistribution,
        metrics: { totalCases, closedCases, resolutionRate }
    });
}


async function getHotspotsDetail() {
    const [hotspots] = await db.execute(`
        SELECT 
            incident_location AS location,
            COUNT(*) AS incident_count,
            SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS resolved_count,
            SUM(CASE WHEN status = 'Under Investigation' THEN 1 ELSE 0 END) AS active_count,
            ROUND((COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM cases
                    WHERE incident_location IS NOT NULL AND TRIM(incident_location) != ''), 0)), 1) AS share
        FROM cases
        WHERE incident_location IS NOT NULL AND TRIM(incident_location) != ''
        GROUP BY incident_location
        ORDER BY incident_count DESC
    `);

    const totalIncidents = hotspots.reduce((acc, h) => acc + (h.incident_count || 0), 0);
    const totalResolved = hotspots.reduce((acc, h) => acc + (h.resolved_count || 0), 0);
    const totalActive = hotspots.reduce((acc, h) => acc + (h.active_count || 0), 0);

    return ok({
        hotspots,
        metrics: { locations: hotspots.length, totalIncidents, totalResolved, totalActive }
    });
}


async function getCategoryBreakdownDetail() {
    const [categories] = await db.execute(`
        SELECT 
            cc.name AS crime_category,
            COUNT(c.id) AS total_incidents,
            ROUND((COUNT(c.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM cases), 0)), 1) AS percentage,
            SUM(CASE WHEN c.status = 'Closed' THEN 1 ELSE 0 END) AS closed_count,
            SUM(CASE WHEN c.status = 'Under Investigation' THEN 1 ELSE 0 END) AS active_count,
            SUM(CASE WHEN c.priority IN ('High', 'Critical') THEN 1 ELSE 0 END) AS severe_count
        FROM crime_categories cc
        LEFT JOIN cases c ON cc.id = c.category_id
        GROUP BY cc.id, cc.name
        ORDER BY total_incidents DESC
    `);

    const totalCases = categories.reduce((acc, c) => acc + (c.total_incidents || 0), 0);
    const totalClosed = categories.reduce((acc, c) => acc + (c.closed_count || 0), 0);

    return ok({
        categories,
        metrics: { categories: categories.length, totalCases, totalClosed }
    });
}


module.exports = {
    getDashboard,
    assignCase,
    processStatusApproval,
    decideReassignment,
    resolveProsecutionQuery,
    getAnalytics,
    getHotspotsDetail,
    getCategoryBreakdownDetail
};
