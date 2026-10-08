const db = require('../config/db');
const { ok, fail } = require('../utils/result');

const PROSECUTOR_ROLES = ['Prosecutor'];
const COURT_OUTCOMES = ['Convicted', 'Acquitted', 'Withdrawn', 'Adjourned'];


function isProsecutor(user) {
    return PROSECUTOR_ROLES.includes(user.role);
}


async function getDashboard(user) {
    const [[kpi]] = await db.execute(`
        SELECT 
            SUM(CASE WHEN c.status = 'Forwarded to Prosecution' THEN 1 ELSE 0 END) AS forwarded_count,
            SUM(CASE WHEN cl.status = 'Pending' THEN 1 ELSE 0 END) AS pending_receipt_count,
            SUM(CASE WHEN c.status = 'Forwarded to Prosecution' AND c.court_date IS NOT NULL THEN 1 ELSE 0 END) AS scheduled_count,
            SUM(CASE WHEN c.status = 'Forwarded to Prosecution' AND c.file_location IS NOT NULL THEN 1 ELSE 0 END) AS shelved_count
        FROM cases c
        LEFT JOIN case_custody_log cl ON c.id = cl.case_id
        WHERE c.status = 'Forwarded to Prosecution'
    `);

    const [forwardedCases] = await db.execute(`
        SELECT 
            c.id,
            c.ob_number AS case_number,
            c.incident_details AS title,
            cc.name AS crime_category,
            c.priority,
            c.status,
            c.forwarded_at,
            c.file_location,
            c.court_date,
            c.court_outcome,
            c.prosecution_query,
            STRING_AGG(CONCAT(inv.rank_title, ' ', inv.first_name, ' ', inv.last_name)
                , ', ' ORDER BY ci.is_lead DESC, inv.last_name) AS investigator_names,
            cl.status AS custody_status,
            cl.id AS custody_id
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN case_investigators ci ON c.id = ci.case_id
        LEFT JOIN users inv ON ci.investigator_id = inv.id
        LEFT JOIN case_custody_log cl ON c.id = cl.case_id
        WHERE c.status = 'Forwarded to Prosecution'
        GROUP BY c.id, cc.name, cl.status, cl.id
        ORDER BY c.forwarded_at ASC
    `);

    const [pendingReceipts] = await db.execute(`
        SELECT 
            cl.id AS custody_id,
            cl.handed_over_at,
            cl.notes AS handover_notes,
            c.id AS case_id,
            c.ob_number AS case_number,
            c.incident_details AS title,
            cc.name AS crime_category,
            c.priority,
            CONCAT(ho.rank_title, ' ', ho.first_name, ' ', ho.last_name) AS handed_over_by_name
        FROM case_custody_log cl
        JOIN cases c ON cl.case_id = c.id
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN users ho ON cl.handed_over_by = ho.id
        WHERE cl.status = 'Pending'
        ORDER BY cl.handed_over_at ASC
    `);

    const [movingFiles] = await db.execute(`
        SELECT c.id, c.ob_number AS case_number, c.court_date, c.court_outcome,
               c.file_location, c.status, cc.name AS crime_category,
               CONCAT(rb.rank_title, ' ', rb.first_name, ' ', rb.last_name) AS received_by_name,
               cl.received_at
        FROM cases c
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN case_custody_log cl ON c.id = cl.case_id AND cl.status = 'Acknowledged'
        LEFT JOIN users rb ON cl.received_by = rb.id
        WHERE c.status IN ('Court Pending', 'Closed') AND c.id IN (
            SELECT case_id FROM case_custody_log WHERE status = 'Acknowledged'
        )
        ORDER BY cl.received_at DESC
        LIMIT 25
    `);

    return ok({
        role: user.role,
        kpi: {
            forwarded: kpi.forwarded_count || 0,
            pendingReceipts: kpi.pending_receipt_count || 0,
            scheduled: kpi.scheduled_count || 0,
            shelved: kpi.shelved_count || 0
        },
        forwardedCases,
        pendingReceipts,
        movingFiles
    });
}


async function acknowledgeReceipt(user, caseId, fileLocation, notes) {
    if (!isProsecutor(user)) {
        return fail(403, 'Only Prosecution officers can acknowledge receipt of forwarded files.');
    }

    const [custodyRows] = await db.execute(`
        SELECT cl.*, c.ob_number FROM case_custody_log cl
        JOIN cases c ON cl.case_id = c.id
        WHERE cl.case_id = ? AND cl.status = 'Pending'
        ORDER BY cl.handed_over_at ASC
    `, [caseId]);

    if (custodyRows.length === 0) {
        return fail(400, 'There is no pending file handover for this case.');
    }

    const custody = custodyRows[0];

    await db.execute(
        `UPDATE case_custody_log
         SET status = 'Acknowledged', received_by = ?, received_at = NOW(),
             file_location = COALESCE(?, file_location), notes = COALESCE(?, notes)
         WHERE id = ?`,
        [user.id, fileLocation || null, notes || null, custody.id]
    );

    await db.execute(
        `UPDATE cases SET file_location = COALESCE(?, file_location) WHERE id = ?`,
        [fileLocation || null, caseId]
    );

    return ok({
        caseId,
        auditDetails: `Prosecutor acknowledged receipt of Case OB ${custody.ob_number}${fileLocation ? ' at ' + fileLocation : ''}.`,
        message: fileLocation
            ? `Receipt acknowledged and file located at "${fileLocation}".`
            : 'Receipt acknowledged. Update the physical location to finalise shelving.'
    });
}


async function updateFileLocation(user, caseId, fileLocation) {
    if (!isProsecutor(user)) {
        return fail(403, 'Only Prosecution officers can update the physical file location.');
    }

    if (!fileLocation || !fileLocation.trim()) {
        return fail(400, 'A physical file location is required, e.g. "Prosecution shelf B3".');
    }

    const [caseRows] = await db.execute('SELECT ob_number FROM cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }

    await db.execute(
        'UPDATE cases SET file_location = ? WHERE id = ?',
        [fileLocation.trim(), caseId]
    );

    await db.execute(
        `UPDATE case_custody_log SET file_location = ? WHERE case_id = ? AND status = 'Acknowledged' AND file_location IS NULL`,
        [fileLocation.trim(), caseId]
    );

    return ok({
        caseId,
        auditDetails: `Prosecutor filed Case OB ${caseRows[0].ob_number} at "${fileLocation.trim()}".`,
        message: `Physical file location updated to "${fileLocation.trim()}".`
    });
}


async function recordCourtDetails(user, caseId, courtDate, courtOutcome) {
    if (!isProsecutor(user)) {
        return fail(403, 'Only Prosecution officers can record court details.');
    }

    if (courtOutcome && !COURT_OUTCOMES.includes(courtOutcome)) {
        return fail(400, 'Invalid court outcome.');
    }

    const [caseRows] = await db.execute('SELECT ob_number FROM cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }

    await db.execute(
        `UPDATE cases SET court_date = COALESCE(?, court_date), court_outcome = COALESCE(?, court_outcome)
         WHERE id = ?`,
        [courtDate || null, courtOutcome || null, caseId]
    );

    const details = [];
    if (courtDate) details.push(`court date ${courtDate}`);
    if (courtOutcome) details.push(`outcome ${courtOutcome}`);

    return ok({
        caseId,
        auditDetails: `Prosecutor recorded ${details.join(' and ')} for Case OB ${caseRows[0].ob_number}.`,
        message: details.length ? `Court details updated (${details.join(', ')}).` : 'No court changes recorded.'
    });
}


async function sendQueryToStation(user, caseId, queryText) {
    if (!isProsecutor(user)) {
        return fail(403, 'Only Prosecution officers can query the Station Officer.');
    }

    if (!queryText || !queryText.trim()) {
        return fail(400, 'A query message is required.');
    }

    const [caseRows] = await db.execute('SELECT id, ob_number, prosecution_query FROM cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }
    if (caseRows[0].prosecution_query) {
        return fail(400, 'A query to the Station Officer is already open for this case.');
    }

    await db.execute(
        `UPDATE cases SET prosecution_query = ?, prosecution_query_at = NOW() WHERE id = ?`,
        [queryText.trim(), caseId]
    );

    await db.execute(
        `INSERT INTO case_minutes (case_id, minute_type, author_id, decision, comment)
         VALUES (?, 'PROSECUTOR_QUERY', ?, 'Query', ?)`,
        [caseId, user.id, queryText.trim()]
    );

    return ok({
        caseId,
        auditDetails: `Prosecutor queried the Station Officer about Case OB ${caseRows[0].ob_number}: ${queryText.trim()}`,
        message: 'Query sent to the Station Officer. It will appear in their command dashboard.'
    });
}


module.exports = {
    getDashboard,
    acknowledgeReceipt,
    updateFileLocation,
    recordCourtDetails,
    sendQueryToStation
};