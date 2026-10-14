const db = require('../config/db');
const { isAssignedInvestigator, getAssignedInvestigators } = require('./assignmentService');
const recordsService = require('./recordsService');
const { ok, fail } = require('../utils/result');
const {
    ROLES,
    CASE_STATUSES,
    roleIn
} = require('../roles');


function textOrNull(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
}


function intOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}


const OVERDUE_DAYS_THRESHOLD = 14;

const SUPERVISOR_ROLES = [ROLES.STATION_OFFICER, ROLES.ADMIN];
const BRANCH_ROLES = [ROLES.BRANCH_OFFICER];
const PROSECUTOR_ROLES = [ROLES.PROSECUTOR];
const RECORDS_ROLES = [ROLES.RECORDS_OFFICER];
const LINK_ROLES = [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER, ROLES.ADMIN];
const COMPLETION_STATUSES = ['Closed', 'Court Pending', 'Forwarded to Prosecution'];


async function listCasesForUser(user) {
    const baseSelect = `
            SELECT
                c.id, c.ob_number, c.complainant_name, c.priority, c.status, c.created_at,
                cc.name AS crime_category,
                su.name AS branch_name,
                CONCAT(recorder.rank_title, ' ', recorder.first_name, ' ', recorder.last_name) AS recorded_by_name,
                STRING_AGG(CONCAT(assigned.rank_title, ' ', assigned.first_name, ' ', assigned.last_name),
                    ', ' ORDER BY ci.is_lead DESC, assigned.last_name) AS assigned_officer_name,
                COUNT(DISTINCT ci.investigator_id) AS investigator_count
            FROM cases c
            LEFT JOIN crime_categories cc ON c.category_id = cc.id
            LEFT JOIN station_branch su ON c.branch_id = su.id
            LEFT JOIN users recorder ON c.recorded_by = recorder.id
            LEFT JOIN case_investigators ci ON c.id = ci.case_id
            LEFT JOIN users assigned ON ci.investigator_id = assigned.id
    `;

    let query;
    let params = [];

    if (roleIn(user, BRANCH_ROLES)) {
        query = `
            ${baseSelect}
            WHERE c.workflow_branch = ?
            GROUP BY c.id, cc.name, su.name, recorder.rank_title, recorder.first_name, recorder.last_name
            ORDER BY c.created_at DESC
        `;
        params = [user.branch];
    } else if (roleIn(user, PROSECUTOR_ROLES)) {
        query = `
            ${baseSelect}
            WHERE c.status IN ('Forwarded to Prosecution', 'Court Pending', 'Closed')
            GROUP BY c.id, cc.name, su.name, recorder.rank_title, recorder.first_name, recorder.last_name
            ORDER BY c.created_at DESC
        `;
    } else if (roleIn(user, SUPERVISOR_ROLES) || roleIn(user, RECORDS_ROLES)) {
        // Station Officers oversee the whole station register; Records Officers
        // maintain it, so both see every case.
        query = `
            ${baseSelect}
            GROUP BY c.id, cc.name, su.name, recorder.rank_title, recorder.first_name, recorder.last_name
            ORDER BY c.created_at DESC
        `;
    } else {
        // Any other officer (Police Officer) sees the cases assigned
        // to them plus the cases they recorded. Investigator status
        // comes from assignment, not the role.
        query = `
            ${baseSelect}
            WHERE c.id IN (SELECT DISTINCT case_id FROM case_investigators WHERE investigator_id = ?)
               OR c.recorded_by = ?
            GROUP BY c.id, cc.name, su.name, recorder.rank_title, recorder.first_name, recorder.last_name
            ORDER BY c.created_at DESC
        `;
        params = [user.id, user.id];
    }

    const [cases] = await db.execute(query, params);
    return cases;
}


async function getCaseFormOptions() {
    // Two independent reads: issue them together so the page pays one network
    // round-trip instead of two.
    const [[categories], [branches]] = await Promise.all([
        db.execute('SELECT id, name, severity_level FROM crime_categories ORDER BY name ASC'),
        db.execute('SELECT id, code, name FROM station_branch ORDER BY name ASC')
    ]);
    return { categories, branches };
}


async function caseExists(caseId) {
    const [rows] = await db.execute('SELECT id FROM cases WHERE id = ?', [caseId]);
    return rows.length > 0;
}


async function createCase(recordingOfficerId, body) {
    const {
        complainant_name,
        complainant_id_number,
        complainant_phone,
        complainant_address,
        complainant_age,
        complainant_occupation,
        complainant_ta,
        complainant_village,
        complainant_gender,
        category_id,
        branch_id,
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
        suspect_address,
        suspect_age,
        suspect_occupation,
        suspect_ta,
        suspect_village,
        witnesses
    } = body;

    if (!complainant_name || !complainant_phone || !category_id || !branch_id || !incident_location || !incident_details) {
        return fail(400, 'Please complete all required fields before submitting.');
    }

    const suspectFirstName = (suspect_first_name || '').trim();
    const suspectLastName = (suspect_last_name || '').trim();
    const suspectSectionUsed = suspectFirstName || suspectLastName || suspect_alias ||
        suspect_gender || suspect_national_id || suspect_phone_number || suspect_address;

    if (suspectSectionUsed && (!suspectFirstName || !suspectLastName)) {
        return fail(400, 'To add a suspect, please provide both the first name and last name (or leave the suspect section blank).');
    }

    // The OB and criminal numbers are not generated here. A registered case
    // is left unnumbered (ob_number NULL, status "Registered") and the Records
    // Officer assigns both numbers through the numbering desk.
    const [caseResult] = await db.execute(
        `INSERT INTO cases (
            complainant_name, complainant_id_number, complainant_phone, complainant_address,
            complainant_age, complainant_occupation, complainant_ta, complainant_village, complainant_gender,
            category_id, branch_id, priority, incident_datetime, incident_location, incident_details, recorded_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            complainant_name,
            complainant_id_number || null,
            complainant_phone,
            complainant_address || null,
            intOrNull(complainant_age),
            textOrNull(complainant_occupation),
            textOrNull(complainant_ta),
            textOrNull(complainant_village),
            complainant_gender || 'Other',
            category_id,
            branch_id,
            priority || 'Medium',
            incident_datetime || null,
            incident_location,
            incident_details,
            recordingOfficerId,
            CASE_STATUSES.REGISTERED
        ]
    );

    let suspectName = null;
    if (suspectSectionUsed) {
        const [suspectResult] = await db.execute(
            `INSERT INTO suspects (first_name, last_name, alias, national_id, gender, phone_number, address, age, occupation, ta, village)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                suspectFirstName,
                suspectLastName,
                suspect_alias ? String(suspect_alias).trim() || null : null,
                suspect_national_id ? String(suspect_national_id).trim() || null : null,
                suspect_gender || 'Other',
                suspect_phone_number ? String(suspect_phone_number).trim() || null : null,
                suspect_address ? String(suspect_address).trim() || null : null,
                intOrNull(suspect_age),
                textOrNull(suspect_occupation),
                textOrNull(suspect_ta),
                textOrNull(suspect_village)
            ]
        );

        await db.execute(
            `INSERT INTO case_suspects (case_id, suspect_id, status) VALUES (?, ?, 'Under Investigation')`,
            [caseResult.insertId, suspectResult.insertId]
        );

        suspectName = `${suspectFirstName} ${suspectLastName}`;
    }

    const witnessList = Array.isArray(witnesses) ? witnesses : [];
    for (const witness of witnessList) {
        const fullName = witness && witness.full_name ? String(witness.full_name).trim() : '';
        if (!fullName) continue;

        await db.execute(
            `INSERT INTO victims (case_id, full_name, phone_number, national_id, address, age, occupation, ta, village, statement)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                caseResult.insertId,
                fullName,
                textOrNull(witness.phone_number),
                textOrNull(witness.national_id),
                textOrNull(witness.address),
                intOrNull(witness.age),
                textOrNull(witness.occupation),
                textOrNull(witness.ta),
                textOrNull(witness.village),
                textOrNull(witness.statement)
            ]
        );
    }

    return ok({
        caseId: caseResult.insertId,
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
        const lookups = [];

        if (type === 'all' || type === 'national_id') {
            lookups.push(
                db.execute(`
                    SELECT c.id, c.ob_number, c.complainant_name, c.complainant_id_number,
                           c.priority, c.status, c.created_at, cc.name AS crime_category
                    FROM cases c
                    LEFT JOIN crime_categories cc ON c.category_id = cc.id
                    WHERE c.complainant_id_number LIKE ?
                    ORDER BY c.created_at DESC LIMIT 20
                `, [like]).then(([rows]) => rows.map(r => ({ ...r, match_type: 'Complainant National ID' })))
            );
        }

        if (type === 'all' || type === 'phone') {
            lookups.push(
                db.execute(`
                    SELECT c.id, c.ob_number, c.complainant_name, c.complainant_phone,
                           c.priority, c.status, c.created_at, cc.name AS crime_category
                    FROM cases c
                    LEFT JOIN crime_categories cc ON c.category_id = cc.id
                    WHERE c.complainant_phone LIKE ?
                    ORDER BY c.created_at DESC LIMIT 20
                `, [like]).then(([rows]) => rows.map(r => ({ ...r, match_type: 'Phone Number' })))
            );
        }

        if (type === 'all' || type === 'suspect') {
            lookups.push(
                db.execute(`
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
                `, [like, like, like, like]).then(([rows]) => rows.map(r => ({ ...r, match_type: 'Suspect Name/ID' })))
            );
        }

        if (type === 'all' || type === 'victim') {
            lookups.push(
                db.execute(`
                    SELECT c.id, c.ob_number, c.complainant_name, c.priority, c.status, c.created_at,
                           cc.name AS crime_category,
                           v.full_name AS victim_name,
                           v.national_id AS victim_national_id
                    FROM cases c
                    JOIN victims v ON c.id = v.case_id
                    LEFT JOIN crime_categories cc ON c.category_id = cc.id
                    WHERE v.full_name LIKE ? OR v.national_id LIKE ?
                    ORDER BY c.created_at DESC LIMIT 20
                `, [like, like]).then(([rows]) => rows.map(r => ({ ...r, match_type: 'Victim Name/ID' })))
            );
        }

        // All matching sources are searched at once rather than one after another.
        results = (await Promise.all(lookups)).flat();

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
    // The case row and all of its child collections are independent reads, so
    // they are issued together: the detail page pays one round-trip instead of
    // eight, which dominates the response time on a remote database.
    const [
        [rows],
        investigators,
        [notes],
        [evidenceItems],
        [suspects],
        [victims],
        [minutes],
        [custodyLog],
        [externalReports]
    ] = await Promise.all([
        db.execute(`
            SELECT
                c.*,
                cc.name AS crime_category,
                su.name AS branch_name,
                CONCAT(recorder.rank_title, ' ', recorder.first_name, ' ', recorder.last_name) AS recorded_by_name,
                CONCAT(req_user.rank_title, ' ', req_user.first_name, ' ', req_user.last_name) AS status_requested_by_name
            FROM cases c
            LEFT JOIN crime_categories cc ON c.category_id = cc.id
            LEFT JOIN station_branch su ON c.branch_id = su.id
            LEFT JOIN users recorder ON c.recorded_by = recorder.id
            LEFT JOIN users req_user ON c.status_requested_by = req_user.id
            WHERE c.id = ?
        `, [caseId]),

        getAssignedInvestigators(caseId),

        db.execute(`
            SELECT n.id, n.note, n.created_at, CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS officer_name
            FROM case_notes n
            LEFT JOIN users u ON n.officer_id = u.id
            WHERE n.case_id = ?
            ORDER BY n.created_at DESC
        `, [caseId]),

        db.execute(`
            SELECT e.*, CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS collected_by_name
            FROM evidence e
            LEFT JOIN users u ON e.collected_by_officer_id = u.id
            WHERE e.case_id = ?
            ORDER BY e.collected_at DESC
        `, [caseId]),

        db.execute(`
            SELECT s.id, s.first_name, s.last_name, s.alias, s.national_id, s.photo_url,
                   s.phone_number, s.gender, s.date_of_birth, s.age, s.occupation, s.ta, s.village, s.address,
                   cs.status AS link_status, cs.arrest_date
            FROM case_suspects cs
            JOIN suspects s ON cs.suspect_id = s.id
            WHERE cs.case_id = ?
        `, [caseId]),

        db.execute(`
            SELECT id, full_name, phone_number, email, national_id, address, age, occupation, ta, village, statement
            FROM victims
            WHERE case_id = ?
        `, [caseId]),

        db.execute(`
            SELECT m.id, m.minute_type, m.decision, m.comment, m.created_at,
                   CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS author_name
            FROM case_minutes m
            LEFT JOIN users u ON m.author_id = u.id
            WHERE m.case_id = ?
            ORDER BY m.created_at ASC
        `, [caseId]),

        db.execute(`
            SELECT cl.*,
                   CONCAT(ho.rank_title, ' ', ho.first_name, ' ', ho.last_name) AS handed_over_by_name,
                   CONCAT(rb.rank_title, ' ', rb.first_name, ' ', rb.last_name) AS received_by_name
            FROM case_custody_log cl
            LEFT JOIN users ho ON cl.handed_over_by = ho.id
            LEFT JOIN users rb ON cl.received_by = rb.id
            WHERE cl.case_id = ?
            ORDER BY cl.handed_over_at ASC
        `, [caseId]),

        db.execute(`
            SELECT er.*, CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS requested_by_name
            FROM external_reports er
            LEFT JOIN users u ON er.requested_by = u.id
            WHERE er.case_id = ?
            ORDER BY er.requested_at DESC
        `, [caseId])
    ]);

    if (rows.length === 0) {
        return fail(404, 'Case record not found.');
    }
    const caseItem = rows[0];

    if (roleIn(user, BRANCH_ROLES) && (!user.branch || caseItem.workflow_branch !== user.branch)) {
        return fail(403, 'You can only access cases from your own branch.');
    }

    const assignedInvestigatorIds = investigators.map(inv => inv.id);
    const assignedInvestigatorNames = investigators.map(inv => `${inv.rank_title} ${inv.first_name} ${inv.last_name}`);

    const isAssignedInvestigator = assignedInvestigatorIds.includes(user.id);
    const isSupervisor = roleIn(user, SUPERVISOR_ROLES);
    const isBranchOfficer = roleIn(user, BRANCH_ROLES);
    const isProsecutor = roleIn(user, PROSECUTOR_ROLES);

    const hasPendingCustody = custodyLog.some(entry => entry.status === 'Pending');

    const permissions = {
        canAddNote: isAssignedInvestigator,
        canRequestStatus: isAssignedInvestigator && !caseItem.requested_status && caseItem.status === 'Under Investigation',
        canAddEvidence: isAssignedInvestigator,
        canLinkSuspectVictim: isAssignedInvestigator || roleIn(user, LINK_ROLES),
        canRequestExternalReport: isAssignedInvestigator && caseItem.status === 'Under Investigation' && !caseItem.requested_status,
        canReview: isBranchOfficer && caseItem.branch_review_status === 'Pending Review',
        canAcknowledgeReceipt: isProsecutor && caseItem.status === 'Forwarded to Prosecution' && hasPendingCustody,
        canUpdateFileLocation: isProsecutor && caseItem.status === 'Forwarded to Prosecution',
        canRecordCourt: isProsecutor && caseItem.status === 'Forwarded to Prosecution',
        canSendQuery: isProsecutor && !caseItem.prosecution_query
    };

    return ok({
        caseItem,
        assignedInvestigatorNames,
        investigators,
        notes,
        minutes,
        custodyLog,
        externalReports,
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
    if (!isAssigned) {
        return fail(403, 'Only investigators assigned to this case can add notes.');
    }

    await db.execute(
        'INSERT INTO case_notes (case_id, officer_id, note) VALUES (?, ?, ?)',
        [caseId, user.id, note.trim()]
    );

    return ok({ caseId });
}


async function requestStatusChange(caseId, user, requestedStatus, statusRequestNotes) {
    if (!COMPLETION_STATUSES.includes(requestedStatus)) {
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
    if (!isAssigned) {
        return fail(403, 'Only investigators assigned to this case can request a status change.');
    }
    if (current.requested_status) {
        return fail(400, 'A status change request is already pending branch review.');
    }

    await db.execute(
        `UPDATE cases
         SET requested_status = ?, status_request_notes = ?, status_requested_by = ?, status_requested_at = NOW(),
             branch_review_status = 'Pending Review', branch_reviewed_by = NULL, branch_reviewed_at = NULL
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
    if (!isAssigned) {
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
    const {
        first_name, last_name, alias, national_id, gender, phone_number, photo_url, notes,
        address, age, occupation, ta, village
    } = data;

    if (!first_name || !last_name || !gender) {
        return fail(400, 'Suspect first name, last name, and gender are required.');
    }

    if (!await caseExists(caseId)) {
        return fail(404, 'Case not found.');
    }

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    const allowed = isAssigned || roleIn(user, LINK_ROLES);
    if (!allowed) {
        return fail(403, 'You do not have permission to link suspects to this case.');
    }

    const [suspectResult] = await db.execute(
        `INSERT INTO suspects (first_name, last_name, alias, national_id, gender, phone_number, address, photo_url, notes, age, occupation, ta, village)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            first_name,
            last_name,
            alias || null,
            national_id || null,
            gender,
            phone_number || null,
            textOrNull(address),
            photo_url || null,
            notes || null,
            intOrNull(age),
            textOrNull(occupation),
            textOrNull(ta),
            textOrNull(village)
        ]
    );

    await db.execute(
        `INSERT INTO case_suspects (case_id, suspect_id, status) VALUES (?, ?, 'Under Investigation')`,
        [caseId, suspectResult.insertId]
    );

    return ok({ caseId, suspectName: `${first_name} ${last_name}` });
}


async function linkVictim(caseId, user, data) {
    const { full_name, phone_number, email, national_id, address, statement, age, occupation, ta, village } = data;

    if (!full_name) {
        return fail(400, 'Victim full name is required.');
    }

    if (!await caseExists(caseId)) {
        return fail(404, 'Case not found.');
    }

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    const allowed = isAssigned || roleIn(user, LINK_ROLES);
    if (!allowed) {
        return fail(403, 'You do not have permission to link victims to this case.');
    }

    await db.execute(
        `INSERT INTO victims (case_id, full_name, phone_number, email, national_id, address, statement, age, occupation, ta, village)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            caseId,
            full_name,
            phone_number || null,
            email || null,
            national_id || null,
            textOrNull(address),
            statement || null,
            intOrNull(age),
            textOrNull(occupation),
            textOrNull(ta),
            textOrNull(village)
        ]
    );

    return ok({ caseId, victimName: full_name });
}


async function requestExternalReport(caseId, user, data) {
    const { report_type, notes } = data;

    if (!report_type || !['Social Welfare Report', 'Medical Report'].includes(report_type)) {
        return fail(400, 'Invalid external report type.');
    }

    if (!await caseExists(caseId)) {
        return fail(404, 'Case not found.');
    }

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    if (!isAssigned) {
        return fail(403, 'Only investigators assigned to this case can request external reports.');
    }

    await db.execute(
        `INSERT INTO external_reports (case_id, report_type, requested_by, status, notes)
         VALUES (?, ?, ?, 'Requested', ?)`,
        [caseId, report_type, user.id, notes || null]
    );

    return ok({ caseId, reportType: report_type });
}


async function getPersonalDashboard(user) {
    if (roleIn(user, [ROLES.ADMIN])) {
        return ok({ variant: 'redirect', role: user.role, target: '/admin/dashboard' });
    }

    if (roleIn(user, BRANCH_ROLES)) {
        return ok({ variant: 'redirect', role: user.role, target: '/branch/dashboard' });
    }

    if (roleIn(user, PROSECUTOR_ROLES)) {
        return ok({ variant: 'redirect', role: user.role, target: '/prosecution/dashboard' });
    }

    if (roleIn(user, [ROLES.STATION_OFFICER])) {
        return ok({ variant: 'redirect', role: user.role, target: '/supervisor/dashboard' });
    }

    // The Records Officer works from the numbering desk: registered cases
    // awaiting an OB and criminal number, plus the numbers assigned recently.
    if (roleIn(user, [ROLES.RECORDS_OFFICER])) {
        return recordsService.getRecordsDashboard(user);
    }

    // Police Officer: the cases assigned to them. The KPI totals and the
    // case list are independent, so they run together.
    const [[[kpi]], [assignedCases]] = await Promise.all([
        db.execute(`
        SELECT
            COUNT(DISTINCT c.id) AS total_assigned,
            SUM(CASE WHEN c.status = 'Under Investigation' THEN 1 ELSE 0 END) AS active_count,
            SUM(CASE WHEN c.status = 'Under Investigation' AND CURRENT_DATE - c.created_at::date > ${OVERDUE_DAYS_THRESHOLD} THEN 1 ELSE 0 END) AS overdue_count,
            SUM(CASE WHEN c.status = 'Closed' THEN 1 ELSE 0 END) AS closed_count,
            SUM(CASE WHEN c.requested_status IS NOT NULL THEN 1 ELSE 0 END) AS pending_request_count
        FROM cases c
        JOIN case_investigators ci ON c.id = ci.case_id
        WHERE ci.investigator_id = ?
    `, [user.id]),

        db.execute(`
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
    `, [user.id])
    ]);

    return ok({
        variant: 'investigator',
        role: user.role,
        overdueDaysThreshold: OVERDUE_DAYS_THRESHOLD,
        kpi: {
            totalAssigned: kpi.total_assigned || 0,
            active: kpi.active_count || 0,
            overdue: kpi.overdue_count || 0,
            closed: kpi.closed_count || 0,
            pendingRequest: kpi.pending_request_count || 0
        },
        assignedCases
    });
}


module.exports = {
    OVERDUE_DAYS_THRESHOLD,
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
    requestExternalReport,
    getPersonalDashboard
};
