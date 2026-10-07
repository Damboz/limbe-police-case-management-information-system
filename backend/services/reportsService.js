const db = require('../config/db');
const { ok, fail } = require('../utils/result');
const { periodAnd } = require('../utils/reportPeriod');
const { isAssignedInvestigator } = require('./assignmentService');


function buildScope(user) {
    const isInvestigator = user.role === 'Investigating Officer';
    const whereClause = isInvestigator
        ? 'WHERE c.id IN (SELECT ci.case_id FROM case_investigators ci WHERE ci.investigator_id = ?)'
        : 'WHERE c.intake_officer_id = ?';
    return { isInvestigator, whereClause, params: [user.id] };
}


async function getMyAnalytics(user) {
    const { isInvestigator, whereClause, params } = buildScope(user);

    const [monthlyTrends] = await db.execute(`
        SELECT 
            TO_CHAR(c.created_at, 'Mon YYYY') AS month_label,
            COUNT(*) AS total_cases,
            SUM(CASE WHEN c.priority IN ('High', 'Critical') THEN 1 ELSE 0 END) AS severe_cases
        FROM cases c
        ${whereClause}
        GROUP BY TO_CHAR(c.created_at, 'YYYY-MM'), month_label
        ORDER BY TO_CHAR(c.created_at, 'YYYY-MM') ASC
        LIMIT 12
    `, params);

    const [statusDistribution] = await db.execute(`
        SELECT status, COUNT(*) AS total_count
        FROM cases c
        ${whereClause}
        GROUP BY status
    `, params);

    const [categoryBreakdown] = await db.execute(`
        SELECT 
            cc.name AS crime_category,
            COUNT(c.id) AS total_incidents
        FROM crime_categories cc
        LEFT JOIN cases c ON cc.id = c.category_id
        ${whereClause}
        GROUP BY cc.id, cc.name
        ORDER BY total_incidents DESC
    `, params);

    const [hotspots] = await db.execute(`
        SELECT incident_location AS location, COUNT(*) AS incident_count
        FROM cases c
        ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} incident_location IS NOT NULL AND TRIM(incident_location) != ''
        GROUP BY incident_location
        ORDER BY incident_count DESC
        LIMIT 8
    `, params);

    const [pendingRequests] = await db.execute(`
        SELECT COUNT(*) AS pendingCount
        FROM cases c
        ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} requested_status IS NOT NULL
    `, params);

    const totalCases = statusDistribution.reduce((acc, s) => acc + s.total_count, 0);
    const closedCases = statusDistribution.find(s => s.status === 'Closed')?.total_count || 0;
    const resolutionRate = totalCases > 0 ? Number(((closedCases / totalCases) * 100).toFixed(1)) : 0;

    return ok({
        role: user.role,
        metrics: {
            totalCases,
            closedCases,
            resolutionRate,
            pendingRequests: pendingRequests[0]?.pendingCount || 0
        },
        statusDistribution,
        monthlyTrends,
        categoryBreakdown,
        hotspots,
        isInvestigator
    });
}


async function getCasesForReport(user, period) {
    const { isInvestigator } = buildScope(user);
    const window = periodAnd(period, 'c.created_at');

    const [cases] = await db.execute(`
        SELECT c.*, cc.name AS crime_category
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        ${isInvestigator
            ? 'WHERE c.id IN (SELECT ci.case_id FROM case_investigators ci WHERE ci.investigator_id = ?)'
            : 'WHERE c.intake_officer_id = ?'}
        ${window.sql}
        ORDER BY c.created_at DESC
    `, [user.id, ...window.params]);

    return cases;
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
    const allowed = (user.role === 'Investigating Officer' && isAssigned)
        || ['Counter/Intake Officer', 'Station Commander', 'Admin'].includes(user.role);
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
    prepareSuspectInvitation
};
