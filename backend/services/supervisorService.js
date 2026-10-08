const db = require('../config/db');
const { syncCaseInvestigators } = require('./assignmentService');
const { OVERDUE_DAYS_THRESHOLD } = require('./caseService');
const { ok, fail } = require('../utils/result');

const COMMANDER_ROLES = ['Station Commander', 'supervisor'];


async function getDashboard() {
    const [[kpiCounts]] = await db.execute(`
        SELECT 
            SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM case_investigators ci WHERE ci.case_id = c.id) AND c.status != 'Closed' THEN 1 ELSE 0 END) AS unassigned_count,
            SUM(CASE WHEN c.requested_status IS NOT NULL THEN 1 ELSE 0 END) AS pending_approvals_count,
            SUM(CASE WHEN c.status = 'Under Investigation' THEN 1 ELSE 0 END) AS active_cases_count,
            SUM(CASE WHEN c.status = 'Under Investigation' AND CURRENT_DATE - c.created_at::date > ${OVERDUE_DAYS_THRESHOLD} THEN 1 ELSE 0 END) AS overdue_count
        FROM cases c
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
            c.status_request_notes,
            c.status_requested_at,
            CONCAT(inv.rank_title, ' ', inv.last_name) AS investigator_name
        FROM cases c
        LEFT JOIN case_investigators cil ON c.id = cil.case_id AND cil.is_lead = 1
        LEFT JOIN users inv ON cil.investigator_id = inv.id
        WHERE c.requested_status IS NOT NULL
        ORDER BY c.status_requested_at ASC
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
        WHERE u.role IN ('Investigating Officer', 'investigator') AND u.is_active = 1
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
            overdue: kpiCounts.overdue_count || 0
        },
        overdueDaysThreshold: OVERDUE_DAYS_THRESHOLD,
        unassignedCases,
        pendingApprovals,
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
         WHERE id IN (${placeholders}) AND role IN ('Investigating Officer', 'investigator') AND is_active = 1`,
        ids
    );

    if (inv.length === 0) {
        return fail(400, 'Selected officers are not active investigators.');
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
        return fail(403, 'Only Station Commanders can approve or reject status change requests.');
    }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
        return fail(400, 'Invalid decision provided.');
    }

    const [caseRows] = await db.execute('SELECT id, ob_number, requested_status FROM cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0 || !caseRows[0].requested_status) {
        return fail(404, 'No pending status change request found for this case.');
    }

    const currentCase = caseRows[0];
    const targetStatus = decision === 'APPROVE' ? currentCase.requested_status : 'Under Investigation';

    await db.execute(
        `UPDATE cases 
         SET status = ?, requested_status = NULL, status_request_notes = NULL, 
             status_requested_by = NULL, status_requested_at = NULL, updated_at = NOW() 
         WHERE id = ?`,
        [targetStatus, caseId]
    );

    return ok({
        caseId,
        obNumber: currentCase.ob_number,
        targetStatus,
        decision,
        auditDetails: `Supervisor ${decision}D status change request for Case OB ${currentCase.ob_number}. New status: ${targetStatus}. ${supervisorNotes ? 'Notes: ' + supervisorNotes : ''}`,
        message: `Case OB ${currentCase.ob_number} status updated to ${targetStatus}.`
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
    getAnalytics,
    getHotspotsDetail,
    getCategoryBreakdownDetail
};
