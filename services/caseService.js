const db = require('../config/db');
const { isAssignedInvestigator, getAssignedInvestigators } = require('./assignmentService');
const { ok, fail } = require('../utils/result');

const OVERDUE_DAYS_THRESHOLD = 14;

const SUPERVISOR_ROLES = ['Station Commander', 'Admin'];
const LINK_ROLES = ['Counter/Intake Officer', 'Station Commander', 'Admin'];


async function generateObNumber() {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');

    const [[{ todayCount }]] = await db.execute(
        `SELECT COUNT(*) AS todayCount FROM cases WHERE DATE(created_at) = CURRENT_DATE`
    );

    const sequence = String(todayCount + 1).padStart(4, '0');
    return `OB-${datePart}-${sequence}`;
}


async function listCasesForUser(user) {
    const baseSelect = `
            SELECT 
                c.id, c.ob_number, c.complainant_name, c.priority, c.status, c.created_at,
                cc.name AS crime_category,
                su.name AS unit_name,
                CONCAT(intake.rank_title, ' ', intake.first_name, ' ', intake.last_name) AS intake_officer_name,
                STRING_AGG(CONCAT(assigned.rank_title, ' ', assigned.first_name, ' ', assigned.last_name),
                    ', ' ORDER BY ci.is_lead DESC, assigned.last_name) AS assigned_officer_name,
                COUNT(DISTINCT ci.investigator_id) AS investigator_count
            FROM cases c
            LEFT JOIN crime_categories cc ON c.category_id = cc.id
            LEFT JOIN station_units su ON c.unit_id = su.id
            LEFT JOIN users intake ON c.intake_officer_id = intake.id
            LEFT JOIN case_investigators ci ON c.id = ci.case_id
            LEFT JOIN users assigned ON ci.investigator_id = assigned.id
    `;

    let query;
    let params = [];

    if (user.role === 'Investigating Officer') {
        query = `
            ${baseSelect}
            WHERE c.id IN (SELECT DISTINCT case_id FROM case_investigators WHERE investigator_id = ?)
            GROUP BY c.id, cc.name, su.name, intake.rank_title, intake.first_name, intake.last_name
            ORDER BY c.created_at DESC
        `;
        params = [user.id];
    } else {
        query = `
            ${baseSelect}
            GROUP BY c.id, cc.name, su.name, intake.rank_title, intake.first_name, intake.last_name
            ORDER BY c.created_at DESC
        `;
    }

    const [cases] = await db.execute(query, params);
    return cases;
}


async function getCaseFormOptions() {
    const [categories] = await db.execute('SELECT id, name, severity_level FROM crime_categories ORDER BY name ASC');
    const [units] = await db.execute('SELECT id, code, name FROM station_units ORDER BY name ASC');
    return { categories, units };
}


async function caseExists(caseId) {
    const [rows] = await db.execute('SELECT id FROM cases WHERE id = ?', [caseId]);
    return rows.length > 0;
}


async function createCase(intakeOfficerId, body) {
    const {
        complainant_name,
        complainant_id_number,
        complainant_phone,
        complainant_address,
        complainant_gender,
        category_id,
        unit_id,
        priority,
        incident_datetime,
        incident_location,
        incident_details,
        suspect_first_name,
        suspect_last_name,
        suspect_alias,
        suspect_gender,
        suspect_national_id,
        suspect_phone_number,
        suspect_address
    } = body;

    if (!complainant_name || !complainant_phone || !category_id || !unit_id || !incident_location || !incident_details) {
        return fail(400, 'Please complete all required fields before submitting.');
    }

    const suspectFirstName = (suspect_first_name || '').trim();
    const suspectLastName = (suspect_last_name || '').trim();
    const suspectSectionUsed = suspectFirstName || suspectLastName || suspect_alias ||
        suspect_gender || suspect_national_id || suspect_phone_number || suspect_address;

    if (suspectSectionUsed && (!suspectFirstName || !suspectLastName)) {
        return fail(400, 'To add a suspect, please provide both the first name and last name (or leave the suspect section blank).');
    }

    const obNumber = await generateObNumber();

    const [caseResult] = await db.execute(
        `INSERT INTO cases (
            ob_number, complainant_name, complainant_id_number, complainant_phone,
            complainant_address, complainant_gender, category_id, unit_id, priority,
            incident_datetime, incident_location, incident_details, intake_officer_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Reported')`,
        [
            obNumber,
            complainant_name,
            complainant_id_number || null,
            complainant_phone,
            complainant_address || null,
            complainant_gender || 'Other',
            category_id,
            unit_id,
            priority || 'Medium',
            incident_datetime || null,
            incident_location,
            incident_details,
            intakeOfficerId
        ]
    );

    let suspectName = null;
    if (suspectSectionUsed) {
        const [suspectResult] = await db.execute(
            `INSERT INTO suspects (first_name, last_name, alias, national_id, gender, phone_number, address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                suspectFirstName,
                suspectLastName,
                suspect_alias ? String(suspect_alias).trim() || null : null,
                suspect_national_id ? String(suspect_national_id).trim() || null : null,
                suspect_gender || 'Other',
                suspect_phone_number ? String(suspect_phone_number).trim() || null : null,
                suspect_address ? String(suspect_address).trim() || null : null
            ]
        );

        await db.execute(
            `INSERT INTO case_suspects (case_id, suspect_id, status) VALUES (?, ?, 'Under Investigation')`,
            [caseResult.insertId, suspectResult.insertId]
        );

        suspectName = `${suspectFirstName} ${suspectLastName}`;
    }

    return ok({
        caseId: caseResult.insertId,
        obNumber,
        suspectName,
        complainantName: complainant_name
    });
}


async function searchCases(query, searchType) {
    const term = (query || '').trim();
    const type = searchType || 'all';
    let results = [];

    if (term.length >= 2) {
        const like = `%${term}%`;

        if (type === 'all' || type === 'national_id') {
            const [casesByComplainantId] = await db.execute(`
                SELECT c.id, c.ob_number, c.complainant_name, c.complainant_id_number,
                       c.priority, c.status, c.created_at, cc.name AS crime_category
                FROM cases c
                LEFT JOIN crime_categories cc ON c.category_id = cc.id
                WHERE c.complainant_id_number LIKE ?
                ORDER BY c.created_at DESC LIMIT 20
            `, [like]);
            results.push(...casesByComplainantId.map(r => ({ ...r, match_type: 'Complainant National ID' })));
        }

        if (type === 'all' || type === 'phone') {
            const [casesByPhone] = await db.execute(`
                SELECT c.id, c.ob_number, c.complainant_name, c.complainant_phone,
                       c.priority, c.status, c.created_at, cc.name AS crime_category
                FROM cases c
                LEFT JOIN crime_categories cc ON c.category_id = cc.id
                WHERE c.complainant_phone LIKE ?
                ORDER BY c.created_at DESC LIMIT 20
            `, [like]);
            results.push(...casesByPhone.map(r => ({ ...r, match_type: 'Phone Number' })));
        }

        if (type === 'all' || type === 'suspect') {
            const [suspectCases] = await db.execute(`
                SELECT c.id, c.ob_number, c.complainant_name, c.priority, c.status, c.created_at,
                       cc.name AS crime_category,
                       CONCAT(s.first_name, ' ', s.last_name) AS suspect_name,
                       s.national_id AS suspect_national_id
                FROM cases c
                JOIN case_suspects cs ON c.id = cs.case_id
                JOIN suspects s ON cs.suspect_id = s.id
                LEFT JOIN crime_categories cc ON c.category_id = cc.id
                WHERE s.first_name LIKE ? OR s.last_name LIKE ? OR s.national_id LIKE ? OR s.alias LIKE ?
                ORDER BY c.created_at DESC LIMIT 20
            `, [like, like, like, like]);
            results.push(...suspectCases.map(r => ({ ...r, match_type: 'Suspect Name/ID' })));
        }

        if (type === 'all' || type === 'victim') {
            const [victimCases] = await db.execute(`
                SELECT c.id, c.ob_number, c.complainant_name, c.priority, c.status, c.created_at,
                       cc.name AS crime_category,
                       v.full_name AS victim_name,
                       v.national_id AS victim_national_id
                FROM cases c
                JOIN victims v ON c.id = v.case_id
                LEFT JOIN crime_categories cc ON c.category_id = cc.id
                WHERE v.full_name LIKE ? OR v.national_id LIKE ?
                ORDER BY c.created_at DESC LIMIT 20
            `, [like, like]);
            results.push(...victimCases.map(r => ({ ...r, match_type: 'Victim Name/ID' })));
        }

        const seen = new Set();
        results = results.filter(r => {
            const key = `${r.id}-${r.match_type}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    return results;
}


async function getCaseDetail(caseId, user) {
    const [rows] = await db.execute(`
        SELECT 
            c.*,
            cc.name AS crime_category,
            su.name AS unit_name,
            CONCAT(intake.rank_title, ' ', intake.first_name, ' ', intake.last_name) AS intake_officer_name,
            CONCAT(req_user.rank_title, ' ', req_user.first_name, ' ', req_user.last_name) AS status_requested_by_name
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN station_units su ON c.unit_id = su.id
        LEFT JOIN users intake ON c.intake_officer_id = intake.id
        LEFT JOIN users req_user ON c.status_requested_by = req_user.id
        WHERE c.id = ?
    `, [caseId]);

    if (rows.length === 0) {
        return fail(404, 'Case record not found.');
    }
    const caseItem = rows[0];

    const investigators = await getAssignedInvestigators(caseId);
    const assignedInvestigatorIds = investigators.map(inv => inv.id);
    const assignedInvestigatorNames = investigators.map(inv => `${inv.rank_title} ${inv.first_name} ${inv.last_name}`);

    const [notes] = await db.execute(`
        SELECT n.id, n.note, n.created_at, CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS officer_name
        FROM case_notes n
        LEFT JOIN users u ON n.officer_id = u.id
        WHERE n.case_id = ?
        ORDER BY n.created_at DESC
    `, [caseId]);

    const [evidenceItems] = await db.execute(`
        SELECT e.*, CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS collected_by_name
        FROM evidence e
        LEFT JOIN users u ON e.collected_by_officer_id = u.id
        WHERE e.case_id = ?
        ORDER BY e.collected_at DESC
    `, [caseId]);

    const [suspects] = await db.execute(`
        SELECT s.id, s.first_name, s.last_name, s.alias, s.national_id, s.photo_url,
               s.phone_number, cs.status AS link_status, cs.arrest_date
        FROM case_suspects cs
        JOIN suspects s ON cs.suspect_id = s.id
        WHERE cs.case_id = ?
    `, [caseId]);

    const [victims] = await db.execute(`
        SELECT id, full_name, phone_number, email, national_id, statement
        FROM victims
        WHERE case_id = ?
    `, [caseId]);

    const isAssignedInvestigator = user.role === 'Investigating Officer' && assignedInvestigatorIds.includes(user.id);
    const isIntakeOfficer = user.role === 'Counter/Intake Officer';
    const isSupervisor = SUPERVISOR_ROLES.includes(user.role);

    const permissions = {
        canAddNote: isAssignedInvestigator,
        canRequestStatus: isAssignedInvestigator && !caseItem.requested_status && caseItem.status === 'Under Investigation',
        canAddEvidence: isAssignedInvestigator,
        canLinkSuspectVictim: isAssignedInvestigator || isIntakeOfficer || isSupervisor
    };

    return ok({
        caseItem,
        investigators,
        assignedInvestigatorNames,
        notes,
        evidenceItems,
        suspects,
        victims,
        permissions
    });
}


async function addCaseNote(caseId, user, note) {
    if (!note || !note.trim()) {
        return fail(400, 'Note cannot be empty.');
    }

    if (!await caseExists(caseId)) {
        return fail(404, 'Case not found.');
    }

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    if (user.role !== 'Investigating Officer' || !isAssigned) {
        return fail(403, 'Only investigators assigned to this case can add notes.');
    }

    await db.execute(
        'INSERT INTO case_notes (case_id, officer_id, note) VALUES (?, ?, ?)',
        [caseId, user.id, note.trim()]
    );

    return ok({ caseId });
}


async function requestStatusChange(caseId, user, requestedStatus, statusRequestNotes) {
    if (!['Closed', 'Court Pending'].includes(requestedStatus)) {
        return fail(400, 'Invalid status request.');
    }

    const [caseRows] = await db.execute(
        'SELECT status, requested_status FROM cases WHERE id = ?',
        [caseId]
    );
    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }
    const current = caseRows[0];

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    if (user.role !== 'Investigating Officer' || !isAssigned) {
        return fail(403, 'Only investigators assigned to this case can request a status change.');
    }
    if (current.requested_status) {
        return fail(400, 'A status change request is already pending supervisor review.');
    }

    await db.execute(
        `UPDATE cases 
         SET requested_status = ?, status_request_notes = ?, status_requested_by = ?, status_requested_at = NOW() 
         WHERE id = ?`,
        [requestedStatus, statusRequestNotes || null, user.id, caseId]
    );

    return ok({ caseId, requestedStatus });
}


async function logEvidence(caseId, user, data) {
    const { item_number, description, category, storage_location, collected_at } = data;

    if (!await caseExists(caseId)) {
        return fail(404, 'Case not found.');
    }

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    if (user.role !== 'Investigating Officer' || !isAssigned) {
        return fail(403, 'Only investigators assigned to this case can log evidence.');
    }

    if (!item_number || !description || !storage_location || !collected_at) {
        return fail(400, 'Please complete all required evidence fields.');
    }

    await db.execute(
        `INSERT INTO evidence (case_id, item_number, description, category, storage_location, collected_by_officer_id, collected_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'In Locker')`,
        [caseId, item_number, description, category || 'Physical', storage_location, user.id, collected_at]
    );

    return ok({ caseId, itemNumber: item_number });
}


async function linkSuspect(caseId, user, data) {
    const { first_name, last_name, alias, national_id, gender, phone_number, photo_url, notes } = data;

    if (!first_name || !last_name || !gender) {
        return fail(400, 'Suspect first name, last name, and gender are required.');
    }

    if (!await caseExists(caseId)) {
        return fail(404, 'Case not found.');
    }

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    const allowed = (user.role === 'Investigating Officer' && isAssigned) || LINK_ROLES.includes(user.role);
    if (!allowed) {
        return fail(403, 'You do not have permission to link suspects to this case.');
    }

    const [suspectResult] = await db.execute(
        `INSERT INTO suspects (first_name, last_name, alias, national_id, gender, phone_number, photo_url, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [first_name, last_name, alias || null, national_id || null, gender, phone_number || null, photo_url || null, notes || null]
    );

    await db.execute(
        `INSERT INTO case_suspects (case_id, suspect_id, status) VALUES (?, ?, 'Under Investigation')`,
        [caseId, suspectResult.insertId]
    );

    return ok({ caseId, suspectName: `${first_name} ${last_name}` });
}


async function linkVictim(caseId, user, data) {
    const { full_name, phone_number, email, national_id, address, statement } = data;

    if (!full_name) {
        return fail(400, 'Victim full name is required.');
    }

    if (!await caseExists(caseId)) {
        return fail(404, 'Case not found.');
    }

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    const allowed = (user.role === 'Investigating Officer' && isAssigned) || LINK_ROLES.includes(user.role);
    if (!allowed) {
        return fail(403, 'You do not have permission to link victims to this case.');
    }

    await db.execute(
        `INSERT INTO victims (case_id, full_name, phone_number, email, national_id, address, statement)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [caseId, full_name, phone_number || null, email || null, national_id || null, address || null, statement || null]
    );

    return ok({ caseId, victimName: full_name });
}


async function getPersonalDashboard(user) {
    if (user.role === 'Investigating Officer') {
        const [[kpi]] = await db.execute(`
            SELECT 
                COUNT(DISTINCT c.id) AS totalAssigned,
                SUM(CASE WHEN c.status = 'Under Investigation' THEN 1 ELSE 0 END) AS activeCount,
                SUM(CASE WHEN c.status = 'Under Investigation' AND CURRENT_DATE - c.created_at::date > ${OVERDUE_DAYS_THRESHOLD} THEN 1 ELSE 0 END) AS overdueCount,
                SUM(CASE WHEN c.status = 'Closed' THEN 1 ELSE 0 END) AS closedCount,
                SUM(CASE WHEN c.requested_status IS NOT NULL THEN 1 ELSE 0 END) AS pendingRequestCount
            FROM cases c
            JOIN case_investigators ci ON c.id = ci.case_id
            WHERE ci.investigator_id = ?
        `, [user.id]);

        const [assignedCases] = await db.execute(`
            SELECT 
                c.id, c.ob_number, c.incident_details AS title, cc.name AS crime_category,
                c.priority, c.status, c.requested_status, c.created_at,
                CURRENT_DATE - c.created_at::date AS days_open
            FROM cases c
            JOIN case_investigators ci ON c.id = ci.case_id
            LEFT JOIN crime_categories cc ON c.category_id = cc.id
            WHERE ci.investigator_id = ?
            GROUP BY c.id, cc.name
            ORDER BY CASE c.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END, c.created_at ASC
        `, [user.id]);

        return ok({
            variant: 'investigator',
            role: user.role,
            overdueDaysThreshold: OVERDUE_DAYS_THRESHOLD,
            kpi: {
                totalAssigned: kpi.totalAssigned || 0,
                active: kpi.activeCount || 0,
                overdue: kpi.overdueCount || 0,
                closed: kpi.closedCount || 0,
                pendingRequest: kpi.pendingRequestCount || 0
            },
            assignedCases
        });
    }

    const [[intakeStats]] = await db.execute(`
        SELECT COUNT(*) AS totalIntake
        FROM cases
        WHERE intake_officer_id = ? AND DATE(created_at) = CURRENT_DATE
    `, [user.id]);

    const [recentIntakes] = await db.execute(`
        SELECT id, ob_number, complainant_name, priority, status, created_at
        FROM cases
        WHERE intake_officer_id = ?
        ORDER BY created_at DESC
        LIMIT 10
    `, [user.id]);

    return ok({
        variant: 'intake',
        role: user.role,
        todayIntakeCount: intakeStats.totalIntake || 0,
        recentIntakes
    });
}


module.exports = {
    OVERDUE_DAYS_THRESHOLD,
    generateObNumber,
    listCasesForUser,
    getCaseFormOptions,
    caseExists,
    createCase,
    searchCases,
    getCaseDetail,
    addCaseNote,
    requestStatusChange,
    logEvidence,
    linkSuspect,
    linkVictim,
    getPersonalDashboard
};
