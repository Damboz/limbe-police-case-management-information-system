const db = require('../config/db');
const { ok, fail } = require('../utils/result');
const { ROLES, roleIn } = require('../roles');

const PROSECUTOR_ROLES = [ROLES.PROSECUTOR];


function isProsecutor(user) {
    return roleIn(user, PROSECUTOR_ROLES);
}


async function getDashboard(user) {
    const [[[kpi]], [forwardedCases], [courtCases], [courtOfficers]] = await Promise.all([
        db.execute(`
        SELECT
            SUM(CASE WHEN c.status = 'Forwarded to Prosecution' THEN 1 ELSE 0 END) AS forwarded_count,
            SUM(CASE WHEN c.status = 'Court Pending' THEN 1 ELSE 0 END) AS court_pending_count,
            SUM(CASE WHEN c.status = 'Court Pending' AND c.court_date = CURRENT_DATE THEN 1 ELSE 0 END) AS in_court_today_count
        FROM cases c
        WHERE c.status IN ('Forwarded to Prosecution', 'Court Pending')
    `),

        db.execute(`
        SELECT
            c.id,
            c.ob_number AS case_number,
            c.incident_details AS title,
            cc.name AS crime_category,
            c.priority,
            c.status,
            c.forwarded_at,
            STRING_AGG(CONCAT(inv.rank_title, ' ', inv.first_name, ' ', inv.last_name)
                , ', ' ORDER BY ci.is_lead DESC, inv.last_name) AS investigator_names
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN case_investigators ci ON c.id = ci.case_id
        LEFT JOIN users inv ON ci.investigator_id = inv.id
        WHERE c.status = 'Forwarded to Prosecution'
        GROUP BY c.id, cc.name
        ORDER BY c.forwarded_at ASC
    `),

        db.execute(`
        SELECT
            c.id,
            c.ob_number AS case_number,
            c.incident_details AS title,
            cc.name AS crime_category,
            c.priority,
            c.status,
            c.court_date,
            c.court_outcome,
            CONCAT(co.rank_title, ' ', co.first_name, ' ', co.last_name) AS court_officer_name,
            co.badge_number AS court_officer_badge
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN users co ON c.court_officer_id = co.id
        WHERE c.status IN ('Court Pending', 'Closed') AND c.court_officer_id IS NOT NULL
        ORDER BY c.court_date ASC NULLS LAST
        LIMIT 50
    `),

        db.execute(`
        SELECT id, badge_number, rank_title, first_name, last_name, role
        FROM users
        WHERE is_active = 1
        ORDER BY rank_title, last_name, first_name
    `)
    ]);

    return ok({
        role: user.role,
        kpi: {
            forwarded: kpi.forwarded_count || 0,
            courtPending: kpi.court_pending_count || 0,
            inCourtToday: kpi.in_court_today_count || 0
        },
        forwardedCases,
        courtCases,
        courtOfficers
    });
}


async function forwardToCourt(user, caseId, data) {
    if (!isProsecutor(user)) {
        return fail(403, 'Only Prosecution officers can forward cases to court.');
    }

    const courtDate = String((data && data.courtDate) || '').trim();
    if (!courtDate) {
        return fail(400, 'A court date is required before the case can be forwarded to court.');
    }
    if (Number.isNaN(new Date(`${courtDate}T00:00:00`).getTime())) {
        return fail(400, 'Please provide a valid court date.');
    }

    const courtOfficerId = Number(data && data.courtOfficerId);
    if (!Number.isInteger(courtOfficerId) || courtOfficerId <= 0) {
        return fail(400, 'Please select the officer who will stand with the case in court.');
    }

    const [caseRows] = await db.execute(
        'SELECT id, ob_number, status FROM cases WHERE id = ?',
        [caseId]
    );
    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }

    const currentCase = caseRows[0];
    if (currentCase.status !== 'Forwarded to Prosecution') {
        return fail(400, 'Only cases forwarded to the Prosecution Branch can be forwarded to court.');
    }

    const [officerRows] = await db.execute(
        `SELECT id, badge_number, rank_title, first_name, last_name
         FROM users WHERE id = ? AND is_active = 1`,
        [courtOfficerId]
    );
    if (officerRows.length === 0) {
        return fail(400, 'The selected officer is not an active station user.');
    }

    const officer = officerRows[0];
    const notes = String((data && data.notes) || '').trim();

    await db.execute(
        `UPDATE cases
         SET status = 'Court Pending', court_date = ?, court_officer_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [courtDate, courtOfficerId, caseId]
    );

    await db.execute(
        `INSERT INTO case_minutes (case_id, minute_type, author_id, decision, comment)
         VALUES (?, 'STATION_REVIEW', ?, 'Forwarded', ?)`,
        [caseId, user.id, notes || null]
    );

    const officerName = `${officer.rank_title || ''} ${officer.first_name || ''} ${officer.last_name || ''}`.trim();

    return ok({
        caseId,
        auditDetails: `Prosecutor forwarded Case OB ${currentCase.ob_number} to court on ${courtDate}. Officer ${officerName} (${officer.badge_number}) assigned to stand with the case.${notes ? ' Notes: ' + notes : ''}`,
        message: `Case OB ${currentCase.ob_number} forwarded to court. ${officerName} will stand with the case.`
    });
}


module.exports = {
    getDashboard,
    forwardToCourt
};
