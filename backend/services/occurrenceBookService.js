const db = require('../config/db');
const { ok, fail } = require('../utils/result');
const { ROLES, roleIn } = require('../roles');


const BOOK_ROLES = [ROLES.RECORDS_OFFICER, ROLES.STATION_OFFICER];

const CASE_STATUSES = [
    'Registered', 'Numbered', 'Classified', 'Assigned', 'Under Investigation',
    'Submitted for Review', 'Court Pending', 'Forwarded to Prosecution',
    'Closed', 'Archived'
];


// The Occurrence Book is the station's complete register of approved cases. It
// deliberately includes cases that have not been numbered yet, so the book and
// the physical OB follow the same chronological record.
async function getOccurrenceBook(user, filters = {}) {
    if (!roleIn(user, BOOK_ROLES)) {
        return fail(403, 'Only Records and Station Officers can access the Occurrence Book.');
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


module.exports = {
    getOccurrenceBook,
    CASE_STATUSES
};
