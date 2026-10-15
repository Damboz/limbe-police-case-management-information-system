const db = require('../config/db');
const { ok, fail } = require('../utils/result');
const { periodAnd, periodWhere } = require('../utils/reportPeriod');
const { isAssignedInvestigator } = require('./assignmentService');
const { ROLES, roleIn } = require('../roles');

const INVESTIGATOR_ROLES = [ROLES.POLICE_OFFICER];
const LETTER_ROLES = [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER, ROLES.ADMIN];


function buildScope(user) {
    const isInvestigator = roleIn(user, INVESTIGATOR_ROLES);
    // An officer's scope is the cases assigned to them plus the cases
    // they recorded, matching the case list. Investigator status is per-case.
    const whereClause = 'WHERE (c.id IN (SELECT ci.case_id FROM case_investigators ci WHERE ci.investigator_id = ?) OR c.recorded_by = ?)';
    return { isInvestigator, whereClause, params: [user.id, user.id] };
}


async function getMyAnalytics(user) {
    const { isInvestigator, whereClause, params } = buildScope(user);

    const [monthlyTrends, statusDistribution, categoryBreakdown, hotspots, pendingRequests] = await Promise.all([
        db.execute(`
        SELECT
            TO_CHAR(c.created_at, 'Mon YYYY') AS month_label,
            COUNT(*) AS total_cases,
            SUM(CASE WHEN c.priority IN ('High', 'Critical') THEN 1 ELSE 0 END) AS severe_cases
        FROM cases c
        ${whereClause}
        GROUP BY TO_CHAR(c.created_at, 'YYYY-MM'), month_label
        ORDER BY TO_CHAR(c.created_at, 'YYYY-MM') ASC
        LIMIT 12
    `, params).then(([rows]) => rows),

        db.execute(`
        SELECT status, COUNT(*) AS total_count
        FROM cases c
        ${whereClause}
        GROUP BY status
    `, params).then(([rows]) => rows),

        db.execute(`
        SELECT
            cc.name AS crime_category,
            COUNT(c.id) AS total_incidents
        FROM crime_categories cc
        LEFT JOIN cases c ON cc.id = c.category_id
        ${whereClause}
        GROUP BY cc.id, cc.name
        ORDER BY total_incidents DESC
    `, params).then(([rows]) => rows),

        db.execute(`
        SELECT incident_location AS location, COUNT(*) AS incident_count
        FROM cases c
        ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} incident_location IS NOT NULL AND TRIM(incident_location) != ''
        GROUP BY incident_location
        ORDER BY incident_count DESC
        LIMIT 8
    `, params).then(([rows]) => rows),

        db.execute(`
        SELECT COUNT(*) AS pending_count
        FROM cases c
        ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} requested_status IS NOT NULL
    `, params).then(([rows]) => rows)
    ]);

    const totalCases = statusDistribution.reduce((acc, s) => acc + s.total_count, 0);
    const closedCases = statusDistribution.find(s => s.status === 'Closed')?.total_count || 0;
    const resolutionRate = totalCases > 0 ? Number(((closedCases / totalCases) * 100).toFixed(1)) : 0;

    return ok({
        role: user.role,
        metrics: {
            totalCases,
            closedCases,
            resolutionRate,
            pendingRequests: pendingRequests[0]?.pending_count || 0
        },
        statusDistribution,
        monthlyTrends,
        categoryBreakdown,
        hotspots,
        isInvestigator
    });
}


async function getCasesForReport(user, period) {
    const { whereClause, params } = buildScope(user);
    const window = periodAnd(period, 'c.created_at');

    const [cases] = await db.execute(`
        SELECT c.*, cc.name AS crime_category
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        ${whereClause}
        ${window.sql}
        ORDER BY c.created_at DESC
    `, [...params, ...window.params]);

    return cases;
}


// ---------------------------------------------------------------------------
// Role-scoped report data. Each function returns the rows the PDF controller
// renders. Scoping follows the role: a Branch Officer only sees their own
// workflow branch, while the Records desk, Prosecution and Admin reports are
// station-wide because those roles act across the whole station.
// ---------------------------------------------------------------------------


// Branch Officer: every case classified into the officer's workflow branch.
async function getBranchCasesForReport(user, period) {
    const branch = user.branch || null;
    const window = periodAnd(period, 'c.created_at');

    const [[summary], [statusBreakdown], [cases]] = await Promise.all([
        db.execute(`
            SELECT
                COUNT(*) AS total_cases,
                COALESCE(SUM(CASE WHEN c.status = 'Closed' THEN 1 ELSE 0 END), 0) AS closed_cases,
                COALESCE(SUM(CASE WHEN c.status NOT IN ('Closed', 'Archived') THEN 1 ELSE 0 END), 0) AS active_cases,
                COALESCE(SUM(CASE WHEN c.branch_review_status = 'Pending Review' THEN 1 ELSE 0 END), 0) AS pending_review,
                COALESCE(SUM(CASE WHEN c.branch_review_status = 'Returned' THEN 1 ELSE 0 END), 0) AS returned_cases,
                COALESCE(SUM(CASE WHEN c.status = 'Forwarded to Prosecution' THEN 1 ELSE 0 END), 0) AS forwarded_cases
            FROM cases c
            WHERE c.workflow_branch = ? ${window.sql}
        `, [branch, ...window.params]),

        db.execute(`
            SELECT c.status, COUNT(*) AS total
            FROM cases c
            WHERE c.workflow_branch = ? ${window.sql}
            GROUP BY c.status
            ORDER BY total DESC
        `, [branch, ...window.params]),

        db.execute(`
            SELECT c.id, c.ob_number, c.incident_details, c.priority, c.status, c.created_at,
                   cc.name AS crime_category,
                   STRING_AGG(CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name), ', '
                              ORDER BY ci.is_lead DESC, u.last_name) AS investigator_names
            FROM cases c
            LEFT JOIN crime_categories cc ON c.category_id = cc.id
            LEFT JOIN case_investigators ci ON c.id = ci.case_id
            LEFT JOIN users u ON ci.investigator_id = u.id
            WHERE c.workflow_branch = ? ${window.sql}
            GROUP BY c.id, cc.name
            ORDER BY c.created_at DESC
            LIMIT 100
        `, [branch, ...window.params])
    ]);

    return { branch, summary, statusBreakdown, cases };
}


// Records Officer: the numbering register — cases numbered in the window plus
// the current queue still awaiting an OB / criminal number.
async function getNumberingRegisterForReport(period) {
    const window = periodAnd(period, 'c.numbers_assigned_at');

    const [[summary], [numbered], [pending]] = await Promise.all([
        db.execute(`
            SELECT
                COUNT(*) FILTER (WHERE c.ob_number IS NULL) AS pending_count,
                COUNT(*) FILTER (WHERE c.ob_number IS NOT NULL) AS total_numbered
            FROM cases c
        `),

        db.execute(`
            SELECT c.ob_number, c.criminal_number, c.complainant_name, c.numbers_assigned_at,
                   cc.name AS crime_category,
                   CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS assigned_by_name
            FROM cases c
            LEFT JOIN crime_categories cc ON c.category_id = cc.id
            LEFT JOIN users u ON c.numbers_assigned_by = u.id
            WHERE c.ob_number IS NOT NULL ${window.sql}
            ORDER BY c.numbers_assigned_at DESC NULLS LAST
            LIMIT 200
        `, window.params),

        db.execute(`
            SELECT c.complainant_name, c.priority, c.status, c.created_at,
                   cc.name AS crime_category
            FROM cases c
            LEFT JOIN crime_categories cc ON c.category_id = cc.id
            WHERE c.ob_number IS NULL
            ORDER BY CASE c.priority
                        WHEN 'Critical' THEN 1
                        WHEN 'High' THEN 2
                        WHEN 'Medium' THEN 3
                        WHEN 'Low' THEN 4
                        ELSE 5
                     END, c.created_at ASC
            LIMIT 200
        `)
    ]);

    return { summary, numbered, pending };
}


// Prosecutor: the station's prosecution caseload and court outcomes.
async function getProsecutionCasesForReport(period) {
    const window = periodAnd(period, 'c.forwarded_at');
    const base = "(c.status IN ('Forwarded to Prosecution', 'Court Pending', 'Closed') OR c.court_date IS NOT NULL) AND c.forwarded_at IS NOT NULL";

    const [[summary], [cases]] = await Promise.all([
        db.execute(`
            SELECT
                COUNT(*) AS forwarded_total,
                COALESCE(SUM(CASE WHEN c.status = 'Forwarded to Prosecution' THEN 1 ELSE 0 END), 0) AS pending_prosecution,
                COALESCE(SUM(CASE WHEN c.court_date IS NOT NULL THEN 1 ELSE 0 END), 0) AS scheduled,
                COALESCE(SUM(CASE WHEN c.court_outcome = 'Convicted' THEN 1 ELSE 0 END), 0) AS convicted,
                COALESCE(SUM(CASE WHEN c.court_outcome IN ('Acquitted', 'Withdrawn') THEN 1 ELSE 0 END), 0) AS not_convicted
            FROM cases c
            WHERE ${base} ${window.sql}
        `, window.params),

        db.execute(`
            SELECT c.ob_number, c.incident_details, c.priority, c.status, c.forwarded_at,
                   c.court_date, c.court_outcome, c.file_location,
                   cc.name AS crime_category
            FROM cases c
            LEFT JOIN crime_categories cc ON c.category_id = cc.id
            WHERE ${base} ${window.sql}
            ORDER BY c.forwarded_at DESC
            LIMIT 200
        `, window.params)
    ]);

    return { summary, cases };
}


// Admin: system-wide personnel, case and audit activity snapshot.
async function getSystemReport(period) {
    const caseWindow = periodWhere(period, 'created_at');
    const auditWindow = periodWhere(period, 'created_at');

    const [[userStats], [caseStats], [roleBreakdown], [recentActivity]] = await Promise.all([
        db.execute(`
            SELECT
                COUNT(*) AS total_users,
                COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active_users
            FROM users
        `),

        db.execute(`
            SELECT
                COUNT(*) AS total_cases,
                COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) AS closed_cases,
                COALESCE(SUM(CASE WHEN status NOT IN ('Closed', 'Archived') THEN 1 ELSE 0 END), 0) AS active_cases
            FROM cases
            ${caseWindow.sql}
        `, caseWindow.params),

        db.execute(`
            SELECT role, COUNT(*) AS total
            FROM users
            GROUP BY role
            ORDER BY total DESC
        `),

        db.execute(`
            SELECT action, COUNT(*) AS total
            FROM audit_logs
            ${auditWindow.sql}
            GROUP BY action
            ORDER BY total DESC
            LIMIT 15
        `, auditWindow.params)
    ]);

    return { userStats, caseStats, roleBreakdown, recentActivity };
}


async function prepareSuspectInvitation(caseId, suspectId, user, appearanceDate) {
    if (!appearanceDate) {
        return fail(400, 'Please select the date the suspect is expected to appear.');
    }

    const [caseRows] = await db.execute(`
        SELECT c.*, cc.name AS crime_category
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        WHERE c.id = ?
    `, [caseId]);

    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }
    const caseItem = caseRows[0];

    const [linkRows] = await db.execute(
        'SELECT cs.status AS link_status FROM case_suspects cs WHERE cs.case_id = ? AND cs.suspect_id = ?',
        [caseId, suspectId]
    );
    if (linkRows.length === 0) {
        return fail(400, 'The suspect is not linked to this case.');
    }

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    const allowed = isAssigned || roleIn(user, LETTER_ROLES);
    if (!allowed) {
        return fail(403, 'You do not have permission to generate a letter for this case.');
    }

    const [suspectRows] = await db.execute(
        'SELECT first_name, last_name, alias, national_id, phone_number, address FROM suspects WHERE id = ?',
        [suspectId]
    );
    if (suspectRows.length === 0) {
        return fail(404, 'Suspect record not found.');
    }

    return ok({ caseItem, suspect: suspectRows[0] });
}


module.exports = {
    getMyAnalytics,
    getCasesForReport,
    getBranchCasesForReport,
    getNumberingRegisterForReport,
    getProsecutionCasesForReport,
    getSystemReport,
    prepareSuspectInvitation
};
