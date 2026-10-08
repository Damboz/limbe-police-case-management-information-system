const db = require('../config/db');
const { ok, fail } = require('../utils/result');

const BRANCH_ROLES = ['Branch In-charge'];
const INVESTIGATOR_ROLES = ['Investigating Officer', 'investigator'];


function isBranchOfficer(user) {
    return BRANCH_ROLES.includes(user.role);
}


async function getDashboard(user) {
    const branchId = user.branch_id;

    const [[kpi]] = await db.execute(`
        SELECT
            SUM(CASE WHEN c.branch_review_status = 'Pending Review' THEN 1 ELSE 0 END) AS pending_review_count,
            SUM(CASE WHEN c.branch_review_status = 'Returned' THEN 1 ELSE 0 END) AS returned_count,
            SUM(CASE WHEN c.status = 'Under Investigation' THEN 1 ELSE 0 END) AS active_count,
            SUM(CASE WHEN er.status = 'Requested' AND er.report_type IS NOT NULL THEN 1 ELSE 0 END) AS delayed_external_count
        FROM cases c
        LEFT JOIN external_reports er ON c.id = er.case_id AND er.status = 'Requested'
        WHERE c.branch_id = ?
    `, [branchId]);

    const [pendingReviews] = await db.execute(`
        SELECT 
            c.id,
            c.ob_number AS case_number,
            c.incident_details AS title,
            c.requested_status,
            c.status_request_notes,
            c.status_requested_at,
            cc.name AS crime_category,
            c.priority,
            STRING_AGG(DISTINCT CONCAT(inv.rank_title, ' ', inv.first_name, ' ', inv.last_name), ', ' ORDER BY CONCAT(inv.rank_title, ' ', inv.first_name, ' ', inv.last_name)) AS investigator_names
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN case_investigators ci ON c.id = ci.case_id
        LEFT JOIN users inv ON ci.investigator_id = inv.id
        WHERE c.branch_id = ? AND c.branch_review_status = 'Pending Review' AND c.requested_status IS NOT NULL
        GROUP BY c.id, cc.name
        ORDER BY c.status_requested_at ASC
    `, [branchId]);

    const [returnedCases] = await db.execute(`
        SELECT c.id, c.ob_number AS case_number, c.incident_details AS title,
               cc.name AS crime_category, c.priority, c.updated_at
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        WHERE c.branch_id = ? AND c.branch_review_status = 'Returned'
        ORDER BY c.updated_at DESC
        LIMIT 20
    `, [branchId]);

    const [branchActiveCases] = await db.execute(`
        SELECT 
            c.id,
            c.ob_number AS case_number,
            c.incident_details AS title,
            cc.name AS crime_category,
            c.priority,
            c.status,
            c.created_at,
            CURRENT_DATE - c.created_at::date AS days_open,
            STRING_AGG(CONCAT(inv.rank_title, ' ', inv.first_name, ' ', inv.last_name)
                , ', ' ORDER BY ci.is_lead DESC, inv.last_name) AS investigator_names,
            (SELECT COUNT(*) FROM cases c2
                WHERE c2.branch_id = c.branch_id
                  AND c2.status IN ('Reported', 'Under Investigation')) AS total_branch_active
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN case_investigators ci ON c.id = ci.case_id
        LEFT JOIN users inv ON ci.investigator_id = inv.id
        WHERE c.branch_id = ? AND c.status IN ('Reported', 'Under Investigation')
        GROUP BY c.id, cc.name
        ORDER BY days_open DESC
        LIMIT 30
    `, [branchId]);

    const [delayedExternalReports] = await db.execute(`
        SELECT 
            er.id,
            er.report_type,
            er.requested_at,
            er.notes,
            c.id AS case_id,
            c.ob_number AS case_number,
            cc.name AS crime_category,
            CONCAT(req.rank_title, ' ', req.first_name, ' ', req.last_name) AS requested_by_name,
            CURRENT_DATE - er.requested_at::date AS days_outstanding
        FROM external_reports er
        JOIN cases c ON er.case_id = c.id
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN users req ON er.requested_by = req.id
        WHERE c.branch_id = ? AND er.status = 'Requested'
        ORDER BY er.requested_at ASC
    `, [branchId]);

    const [branchRow] = await db.execute(
        'SELECT id, code, name FROM station_branch WHERE id = ?',
        [branchId]
    );

    const [[branchCaseStats]] = await db.execute(`
        SELECT
            COUNT(*) AS total_count,
            COALESCE(SUM(CASE WHEN c.status = 'Reported' THEN 1 ELSE 0 END), 0) AS reported_count,
            COALESCE(SUM(CASE WHEN c.status = 'Under Investigation' THEN 1 ELSE 0 END), 0) AS under_investigation_count,
            COALESCE(SUM(CASE WHEN c.status = 'Court Pending' THEN 1 ELSE 0 END), 0) AS court_pending_count,
            COALESCE(SUM(CASE WHEN c.status = 'Forwarded to Prosecution' THEN 1 ELSE 0 END), 0) AS forwarded_count,
            COALESCE(SUM(CASE WHEN c.status = 'Closed' THEN 1 ELSE 0 END), 0) AS closed_count,
            COALESCE(SUM(CASE WHEN c.branch_review_status = 'Returned' THEN 1 ELSE 0 END), 0) AS returned_count
        FROM cases c
        WHERE c.branch_id = ?
    `, [branchId]);

    const [branchCases] = await db.execute(`
        SELECT 
            c.id,
            c.ob_number AS case_number,
            c.incident_details AS title,
            cc.name AS crime_category,
            c.priority,
            c.status,
            c.branch_review_status,
            c.created_at,
            CURRENT_DATE - c.created_at::date AS days_open,
            STRING_AGG(CONCAT(inv.rank_title, ' ', inv.first_name, ' ', inv.last_name)
                , ', ' ORDER BY ci.is_lead DESC, inv.last_name) AS investigator_names
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN case_investigators ci ON c.id = ci.case_id
        LEFT JOIN users inv ON ci.investigator_id = inv.id
        WHERE c.branch_id = ?
        GROUP BY c.id, cc.name
        ORDER BY c.created_at DESC
        LIMIT 100
    `, [branchId]);

    const [investigators] = await db.execute(`
        SELECT u.id, u.badge_number, u.rank_title, u.first_name, u.last_name, u.branch_id,
               su.name AS branch_name,
               (SELECT COUNT(*) FROM case_investigators ci
                 JOIN cases ca ON ci.case_id = ca.id
                 WHERE ci.investigator_id = u.id AND ca.status = 'Under Investigation') AS active_case_count
        FROM users u
        LEFT JOIN station_branch su ON u.branch_id = su.id
        WHERE u.role IN ('Investigating Officer', 'investigator') AND u.is_active = 1
        ORDER BY active_case_count ASC
    `);

    return ok({
        role: user.role,
        branchId: branchId,
        branch: branchRow.length > 0
            ? { id: branchRow[0].id, code: branchRow[0].code, name: branchRow[0].name }
            : { id: branchId, code: '', name: 'My Branch' },
        kpi: {
            pendingReviews: kpi.pending_review_count || 0,
            returned: kpi.returned_count || 0,
            activeCases: kpi.active_count || 0,
            delayedExternal: kpi.delayed_external_count || 0
        },
        branchCaseStats: {
            total: branchCaseStats.total_count || 0,
            reported: branchCaseStats.reported_count || 0,
            underInvestigation: branchCaseStats.under_investigation_count || 0,
            courtPending: branchCaseStats.court_pending_count || 0,
            forwarded: branchCaseStats.forwarded_count || 0,
            closed: branchCaseStats.closed_count || 0,
            returned: branchCaseStats.returned_count || 0
        },
        branchCases,
        pendingReviews,
        returnedCases,
        branchActiveCases,
        delayedExternalReports,
        investigators
    });
}


async function reviewCase(user, caseId, decision, comment) {
    if (!isBranchOfficer(user)) {
        return fail(403, 'Only Branch In-charge officers can review case files.');
    }

    if (!['Recommend', 'Return'].includes(decision)) {
        return fail(400, 'Review decision must be Recommend or Return.');
    }

    if (!comment || !comment.trim()) {
        return fail(400, 'A minute (comment) is required to record the review.');
    }

    const [caseRows] = await db.execute(`
        SELECT id, ob_number, branch_id, requested_status, branch_review_status
        FROM cases WHERE id = ?
    `, [caseId]);

    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }

    const current = caseRows[0];
    if (!user.branch_id || current.branch_id !== user.branch_id) {
        return fail(403, 'This case does not belong to your branch.');
    }
    if (current.branch_review_status !== 'Pending Review' || !current.requested_status) {
        return fail(400, 'There is no completion request awaiting your review for this case.');
    }

    const decisionValue = decision === 'Recommend' ? 'Recommended' : 'Returned';

    await db.execute(
        `UPDATE cases
         SET branch_review_status = ?, branch_reviewed_by = ?, branch_reviewed_at = NOW()
         WHERE id = ?`,
        [decisionValue, user.id, caseId]
    );

    if (decision === 'Return') {
        await db.execute(
            `UPDATE cases
             SET requested_status = NULL, status_request_notes = NULL,
                 status_requested_by = NULL, status_requested_at = NULL
             WHERE id = ?`,
            [caseId]
        );
    }

    await db.execute(
        `INSERT INTO case_minutes (case_id, minute_type, author_id, decision, comment)
         VALUES (?, 'BRANCH_REVIEW', ?, ?, ?)`,
        [caseId, user.id, decisionValue, comment.trim()]
    );

    const message = decision === 'Recommend'
        ? `Reviewed and recommended Case OB ${current.ob_number} for Station Officer approval.`
        : `Case OB ${current.ob_number} returned to the investigator: ${comment.trim()}`;

    return ok({
        caseId,
        obNumber: current.ob_number,
        decision: decisionValue,
        auditDetails: `Branch In-charge ${decisionValue} completion request for Case OB ${current.ob_number}. ${comment.trim()}`,
        message
    });
}


async function proposeReassignment(user, caseId, currentInvestigatorId, proposedInvestigatorId, reason) {
    if (!isBranchOfficer(user)) {
        return fail(403, 'Only Branch In-charge officers can propose reassignments.');
    }

    if (!caseId || !proposedInvestigatorId) {
        return fail(400, 'Please select a valid case and a proposed investigator.');
    }

    if (!reason || !reason.trim()) {
        return fail(400, 'Please provide a reason for the proposed reassignment.');
    }

    const [caseRows] = await db.execute('SELECT id, ob_number, branch_id FROM cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }
    if (!user.branch_id || caseRows[0].branch_id !== user.branch_id) {
        return fail(403, 'This case does not belong to your branch.');
    }

    const targetId = String(proposedInvestigatorId);
    const [inv] = await db.execute(
        `SELECT badge_number, rank_title, first_name, last_name
         FROM users WHERE id = ? AND role IN ('Investigating Officer', 'investigator') AND is_active = 1`,
        [targetId]
    );
    if (inv.length === 0) {
        return fail(400, 'The proposed officer is not an active investigator.');
    }

    const currentId = currentInvestigatorId ? String(currentInvestigatorId) : null;
    if (currentId && currentId === targetId) {
        return fail(400, 'The proposed officer is already the current investigator.');
    }

    const [result] = await db.execute(
        `INSERT INTO reassignment_proposals
            (case_id, current_investigator_id, proposed_investigator_id, proposed_by, reason, status)
         VALUES (?, ?, ?, ?, ?, 'Pending')`,
        [caseId, currentId, targetId, user.id, reason.trim()]
    );

    return ok({
        caseId,
        proposalId: result.insertId,
        obNumber: caseRows[0].ob_number,
        auditDetails: `Branch In-charge proposed reassignment of Case OB ${caseRows[0].ob_number} to ${inv.rank_title} ${inv.first_name} ${inv.last_name} (${inv.badge_number}). Reason: ${reason.trim()}`,
        message: 'Reassignment proposal submitted to the Station Officer for final decision.'
    });
}


async function requestExternalReport(user, caseId, reportType, notes) {
    if (!isBranchOfficer(user)) {
        return fail(403, 'Only Branch In-charge officers or assigned investigators can request external reports.');
    }

    if (!reportType || !['Social Welfare Report', 'Medical Report'].includes(reportType)) {
        return fail(400, 'Invalid external report type.');
    }

    const [caseRows] = await db.execute('SELECT id, branch_id FROM cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }

    const [result] = await db.execute(
        `INSERT INTO external_reports (case_id, report_type, requested_by, status, notes)
         VALUES (?, ?, ?, 'Requested', ?)`,
        [caseId, reportType, user.id, notes || null]
    );

    return ok({
        reportId: result.insertId,
        caseId,
        auditDetails: `Branch In-charge requested a ${reportType} for Case ID ${caseId}.`,
        message: `${reportType} request recorded. It will be flagged until received.`
    });
}


async function markExternalReportReceived(user, reportId, notes) {
    if (!isBranchOfficer(user)) {
        return fail(403, 'Only Branch In-charge officers can confirm receipt of external reports.');
    }

    const [reportRows] = await db.execute(`
        SELECT er.*, c.branch_id FROM external_reports er
        JOIN cases c ON er.case_id = c.id
        WHERE er.id = ?
    `, [reportId]);

    if (reportRows.length === 0) {
        return fail(404, 'External report request not found.');
    }

    const report = reportRows[0];
    if (!user.branch_id || report.branch_id !== user.branch_id) {
        return fail(403, 'This report does not belong to your branch.');
    }
    if (report.status === 'Received') {
        return fail(400, 'This external report has already been marked as received.');
    }

    await db.execute(
        `UPDATE external_reports SET status = 'Received', received_at = NOW(), notes = COALESCE(?, notes)
         WHERE id = ?`,
        [notes || null, reportId]
    );

    return ok({
        reportId,
        auditDetails: `Branch In-charge confirmed receipt of ${report.report_type} for Case ID ${report.case_id}.`,
        message: `${report.report_type} marked as received.`
    });
}


module.exports = {
    getDashboard,
    reviewCase,
    proposeReassignment,
    requestExternalReport,
    markExternalReportReceived
};