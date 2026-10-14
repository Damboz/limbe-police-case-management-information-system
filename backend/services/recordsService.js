const db = require('../config/db');
const { ok, fail } = require('../utils/result');
const { ROLES, roleIn, CASE_STATUSES } = require('../roles');


const RECORDS_ROLES = [ROLES.RECORDS_OFFICER];


// Draw the next value from the yearly OB / criminal number counter. The upsert
// is atomic, so two Records Officers numbering at the same moment each get a
// distinct value without any explicit locking.
async function nextSequence(type) {
    const year = new Date().getFullYear();
    const result = await db.query(
        `INSERT INTO number_sequences (year, type, last_number, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (year, type)
         DO UPDATE SET last_number = number_sequences.last_number + 1, updated_at = NOW()
         RETURNING last_number`,
        [year, type]
    );
    return result.rows[0].last_number;
}


async function generateObNumber() {
    const year = new Date().getFullYear();
    const value = await nextSequence('OB');
    return `OB-${year}-${String(value).padStart(4, '0')}`;
}


async function generateCriminalNumber() {
    const year = new Date().getFullYear();
    const value = await nextSequence('CR');
    return `CR-${year}-${String(value).padStart(4, '0')}`;
}


// Cases that have been registered but do not yet carry an OB number. The queue
// keys off the missing number rather than the status so a case that was
// classified before numbering still reaches the Records Officer.
async function getNumberingQueue() {
    const [rows] = await db.execute(`
        SELECT
            c.id,
            c.complainant_name,
            c.complainant_phone,
            c.priority,
            c.status,
            c.created_at,
            cc.name AS crime_category,
            su.name AS branch_name,
            CONCAT(rec.rank_title, ' ', rec.first_name, ' ', rec.last_name) AS recorded_by_name
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN station_branch su ON c.branch_id = su.id
        LEFT JOIN users rec ON c.recorded_by = rec.id
        WHERE c.ob_number IS NULL
        ORDER BY CASE c.priority
                    WHEN 'Critical' THEN 1
                    WHEN 'High' THEN 2
                    WHEN 'Medium' THEN 3
                    WHEN 'Low' THEN 4
                    ELSE 5
                 END,
                 c.created_at ASC
    `);
    return rows;
}


// The numbering desk KPI totals and the last numbers assigned, issued together
// with the queue so the dashboard pays one network round-trip.
async function getRecordsDashboard(user) {
    if (!roleIn(user, RECORDS_ROLES)) {
        return fail(403, 'Only Records Officers can access the numbering desk.');
    }

    const [
        [[kpi]],
        numberingQueue,
        [recentlyNumbered]
    ] = await Promise.all([
        db.execute(`
            SELECT
                COUNT(*) FILTER (WHERE ob_number IS NULL) AS pending_count,
                COUNT(*) FILTER (
                    WHERE ob_number IS NOT NULL
                      AND numbers_assigned_at::date = CURRENT_DATE
                ) AS numbered_today_count,
                COUNT(*) FILTER (WHERE ob_number IS NOT NULL) AS total_numbered_count
            FROM cases
        `),

        getNumberingQueue(),

        db.execute(`
            SELECT
                c.id,
                c.ob_number,
                c.criminal_number,
                c.complainant_name,
                c.numbers_assigned_at,
                cc.name AS crime_category,
                CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS assigned_by_name
            FROM cases c
            LEFT JOIN crime_categories cc ON c.category_id = cc.id
            LEFT JOIN users u ON c.numbers_assigned_by = u.id
            WHERE c.ob_number IS NOT NULL
            ORDER BY c.numbers_assigned_at DESC NULLS LAST, c.id DESC
            LIMIT 10
        `)
    ]);

    return ok({
        variant: 'records',
        role: user.role,
        kpi: {
            pending: kpi.pending_count || 0,
            numberedToday: kpi.numbered_today_count || 0,
            totalNumbered: kpi.total_numbered_count || 0
        },
        numberingQueue,
        recentlyNumbered
    });
}


// The Records Officer assigns the OB and criminal numbers to a registered case.
// Numbers are drawn from the yearly sequences unless the officer supplies them.
async function assignCaseNumbers(user, caseId, body) {
    if (!roleIn(user, RECORDS_ROLES)) {
        return fail(403, 'Only Records Officers can assign OB and criminal numbers.');
    }

    const [caseRows] = await db.execute(
        'SELECT id, ob_number, criminal_number, status, complainant_name FROM cases WHERE id = ?',
        [caseId]
    );
    if (caseRows.length === 0) {
        return fail(404, 'Case record not found.');
    }

    const current = caseRows[0];
    if (current.ob_number && current.criminal_number) {
        return fail(400, `Case ${current.ob_number} already has its OB and criminal numbers assigned.`);
    }

    const suppliedOb = body && body.ob_number ? String(body.ob_number).trim() : '';
    const suppliedCriminal = body && body.criminal_number ? String(body.criminal_number).trim() : '';

    const obNumber = current.ob_number || suppliedOb || await generateObNumber();
    const criminalNumber = current.criminal_number || suppliedCriminal || await generateCriminalNumber();

    // A case that is still awaiting its numbers moves to "Numbered". A case
    // that somehow progressed (e.g. was classified first) keeps its status.
    const nextStatus = current.status === CASE_STATUSES.REGISTERED
        ? CASE_STATUSES.NUMBERED
        : current.status;

    await db.execute(
        `UPDATE cases
         SET ob_number = ?, criminal_number = ?, numbers_assigned_by = ?,
             numbers_assigned_at = NOW(), status = ?, updated_at = NOW()
         WHERE id = ?`,
        [obNumber, criminalNumber, user.id, nextStatus, caseId]
    );

    return ok({
        caseId,
        obNumber,
        criminalNumber,
        complainantName: current.complainant_name,
        auditDetails: `Assigned OB number ${obNumber} and criminal number ${criminalNumber} to Case ID ${caseId}.`,
        message: `OB number ${obNumber} and criminal number ${criminalNumber} assigned to Case ID ${caseId}.`
    });
}


module.exports = {
    generateObNumber,
    generateCriminalNumber,
    getNumberingQueue,
    getRecordsDashboard,
    assignCaseNumbers
};
