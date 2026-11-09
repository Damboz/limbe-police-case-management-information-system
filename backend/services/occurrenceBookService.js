const db = require('../config/db');
const { ok, fail } = require('../utils/result');
const { ROLES, roleIn } = require('../roles');


const BOOK_ROLES = [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER];

const CASE_STATUSES = [
    'Registered', 'Numbered', 'Classified', 'Assigned', 'Under Investigation',
    'Submitted for Review', 'Court Pending', 'Forwarded to Prosecution',
    'Closed', 'Archived'
];

const REOPEN_TARGET_STATUS = 'Under Investigation';


// The Occurrence Book is the station's complete register of approved cases. It
// deliberately includes cases that have not been numbered yet, so the book and
// the physical OB follow the same chronological record.
async function getOccurrenceBook(user, filters = {}) {
    if (!roleIn(user, BOOK_ROLES)) {
        return fail(403, 'Only Police and Station Officers can access the Occurrence Book.');
    }

    const search = String(filters.q || '').trim();
    const status = String(filters.status || '').trim();

    const where = ["COALESCE(c.complaint_status, 'Approved') = 'Approved'"];
    const params = [];

    if (search) {
        const term = `%${search}%`;
        where.push(`(
            COALESCE(c.ob_number, '') ILIKE ? OR
            COALESCE(c.criminal_number, '') ILIKE ? OR
            c.complainant_name ILIKE ? OR
            COALESCE(c.complainant_phone, '') ILIKE ? OR
            COALESCE(c.incident_location, '') ILIKE ? OR
            COALESCE(c.incident_details, '') ILIKE ?
        )`);
        params.push(term, term, term, term, term, term);
    }

    if (status && CASE_STATUSES.includes(status)) {
        where.push('c.status = ?');
        params.push(status);
    }

    const [cases] = await db.execute(`
        SELECT
            c.id,
            c.ob_number,
            c.criminal_number,
            c.complainant_name,
            c.complainant_phone,
            c.complainant_gender,
            c.incident_datetime,
            c.incident_location,
            c.incident_details,
            c.priority,
            c.status,
            c.created_at,
            c.recorded_at,
            cc.name AS crime_category,
            su.name AS branch_name,
            NULLIF(CONCAT_WS(' ', recorder.rank_title, recorder.first_name, recorder.last_name), '') AS recorded_by_name,
            STRING_AGG(NULLIF(CONCAT_WS(' ', assigned.rank_title, assigned.first_name, assigned.last_name), ''),
                ', ' ORDER BY ci.is_lead DESC, assigned.last_name) AS assigned_officer_name
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN station_branch su ON c.branch_id = su.id
        LEFT JOIN users recorder ON c.recorded_by = recorder.id
        LEFT JOIN case_investigators ci ON c.id = ci.case_id
        LEFT JOIN users assigned ON ci.investigator_id = assigned.id
        WHERE ${where.join(' AND ')}
        GROUP BY c.id, cc.name, su.name, recorder.rank_title, recorder.first_name, recorder.last_name
        ORDER BY CASE WHEN c.ob_number IS NULL THEN 1 ELSE 0 END,
                 c.ob_number ASC,
                 c.created_at DESC
    `, params);

    return ok({
        cases,
        total: cases.length,
        filters: {
            q: search,
            status: status && CASE_STATUSES.includes(status) ? status : ''
        }
    });
}


// Reopening returns a closed case to the investigation pipeline. Any completion
// request, review decision and court scheduling from the previous cycle is
// cleared so the case starts the workflow again from a clean slate.
async function reopenCase(user, caseId, data = {}) {
    if (!roleIn(user, BOOK_ROLES)) {
        return fail(403, 'Only Police and Station Officers can reopen a closed case.');
    }

    const id = Number(caseId);
    if (!Number.isInteger(id) || id <= 0) {
        return fail(400, 'A valid case id is required.');
    }

    const [rows] = await db.execute(
        'SELECT id, ob_number, status FROM cases WHERE id = ?',
        [id]
    );

    if (rows.length === 0) {
        return fail(404, 'Case record not found.');
    }

    const currentCase = rows[0];
    if (currentCase.status !== 'Closed') {
        return fail(400, 'Only cases with a Closed status can be reopened.');
    }

    const notes = String(data.notes || '').trim();

    await db.execute(
        `UPDATE cases
         SET status = ?,
             requested_status = NULL,
             status_request_notes = NULL,
             status_requested_by = NULL,
             status_requested_at = NULL,
             branch_review_status = NULL,
             branch_reviewed_by = NULL,
             branch_reviewed_at = NULL,
             forwarded_at = NULL,
             court_date = NULL,
             court_officer_id = NULL,
             court_outcome = NULL,
             prosecution_query = NULL,
             prosecution_query_at = NULL,
             prosecution_query_resolved_at = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [REOPEN_TARGET_STATUS, id]
    );

    return ok({
        caseId: id,
        obNumber: currentCase.ob_number,
        status: REOPEN_TARGET_STATUS,
        auditDetails: `Reopened closed Case OB ${currentCase.ob_number || id}. Status reset to ${REOPEN_TARGET_STATUS}.${notes ? ' Reason: ' + notes : ''}`,
        message: `Case OB ${currentCase.ob_number || id} reopened for further investigation.`
    });
}


module.exports = {
    getOccurrenceBook,
    reopenCase,
    CASE_STATUSES
};
