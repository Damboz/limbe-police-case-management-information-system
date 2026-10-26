const db = require('../config/db');
const { isAssignedInvestigator } = require('./assignmentService');
const { ok, fail } = require('../utils/result');
const { ROLES, roleIn } = require('../roles');


const PARTY_MANAGE_ROLES = [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER, ROLES.ADMIN];
const ADDABLE_PARTY_TYPES = ['Witness', 'Suspect'];


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


async function withTransaction(fn) {
    const pool = await db.ready();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            // ignore rollback errors
        }
        throw err;
    } finally {
        client.release();
    }
}


async function lockCase(client, caseId) {
    const { rows } = await client.query(
        'SELECT id FROM cases WHERE id = $1 FOR UPDATE',
        [caseId]
    );
    return rows[0] || null;
}


async function nextWitnessNumber(client, caseId) {
    const { rows } = await client.query(
        `SELECT COALESCE(MAX(witness_number), 1) + 1 AS next_number
         FROM case_parties
         WHERE case_id = $1 AND party_type IN ('Complainant', 'Witness')`,
        [caseId]
    );
    return Number(rows[0].next_number);
}


async function addStatement(client, caseId, partyId, statement, recordedBy) {
    const text = textOrNull(statement);
    if (!text) return;

    await client.query(
        `INSERT INTO case_statements (case_id, party_id, statement_text, source, recorded_by)
         VALUES ($1, $2, $3, 'INTAKE', $4)`,
        [caseId, partyId, text, recordedBy]
    );
}


async function createComplainantParty(client, caseItem, createdBy) {
    const { rows } = await client.query(
        `INSERT INTO case_parties (
             case_id, party_type, witness_number, full_name, national_id,
             phone_number, gender, age, occupation, ta, village, address, created_by
         ) VALUES ($1, 'Complainant', 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, case_id, party_type, witness_number, full_name, suspect_id`,
        [
            caseItem.id,
            caseItem.complainant_name,
            textOrNull(caseItem.complainant_id_number),
            textOrNull(caseItem.complainant_phone),
            textOrNull(caseItem.complainant_gender),
            intOrNull(caseItem.complainant_age),
            textOrNull(caseItem.complainant_occupation),
            textOrNull(caseItem.complainant_ta),
            textOrNull(caseItem.complainant_village),
            textOrNull(caseItem.complainant_address),
            createdBy || null
        ]
    );

    return rows[0];
}


async function ensureComplainantParty(client, caseItem, createdBy) {
    const { rows } = await client.query(
        `SELECT id, case_id, party_type, witness_number, full_name, suspect_id
         FROM case_parties
         WHERE case_id = $1 AND party_type = 'Complainant'
         ORDER BY id ASC
         LIMIT 1`,
        [caseItem.id]
    );
    if (rows[0]) {
        return rows[0];
    }
    return createComplainantParty(client, caseItem, createdBy);
}


async function createWitnessParty(client, caseId, data, createdBy) {
    const witnessNumber = await nextWitnessNumber(client, caseId);

    const { rows } = await client.query(
        `INSERT INTO case_parties (
             case_id, party_type, witness_number, full_name, national_id,
             phone_number, email, gender, age, occupation, ta, village,
             address, created_by
         ) VALUES ($1, 'Witness', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, case_id, party_type, witness_number, full_name, suspect_id`,
        [
            caseId,
            witnessNumber,
            textOrNull(data.full_name),
            textOrNull(data.national_id),
            textOrNull(data.phone_number),
            textOrNull(data.email),
            textOrNull(data.gender),
            intOrNull(data.age),
            textOrNull(data.occupation),
            textOrNull(data.ta),
            textOrNull(data.village),
            textOrNull(data.address),
            createdBy || null
        ]
    );

    const party = rows[0];
    await addStatement(client, caseId, party.id, data.statement || data.statement_text, createdBy);
    return party;
}


async function createSuspectParty(client, caseId, data, createdBy) {
    const firstName = textOrNull(data.first_name) || textOrNull(data.firstName);
    const lastName = textOrNull(data.last_name) || textOrNull(data.lastName);
    const fullName = textOrNull(data.full_name) || ([firstName, lastName].filter(Boolean).join(' '));

    const gender = textOrNull(data.gender) || 'Other';

    const suspectInsert = await client.query(
        `INSERT INTO suspects (
             first_name, last_name, alias, national_id, gender, phone_number,
             address, photo_url, notes, age, occupation, ta, village, date_of_birth
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
            firstName,
            lastName,
            textOrNull(data.alias),
            textOrNull(data.national_id),
            gender,
            textOrNull(data.phone_number),
            textOrNull(data.address),
            textOrNull(data.photo_url),
            textOrNull(data.notes),
            intOrNull(data.age),
            textOrNull(data.occupation),
            textOrNull(data.ta),
            textOrNull(data.village),
            textOrNull(data.date_of_birth)
        ]
    );

    const suspectId = suspectInsert.rows[0].id;

    await client.query(
        `INSERT INTO case_suspects (case_id, suspect_id, status)
         VALUES ($1, $2, 'Under Investigation')`,
        [caseId, suspectId]
    );

    const { rows } = await client.query(
        `INSERT INTO case_parties (
             case_id, party_type, suspect_id, full_name, first_name, last_name,
             alias, national_id, phone_number, gender, date_of_birth, age,
             occupation, ta, village, address, photo_url, notes, suspect_status,
             created_by
         ) VALUES (
             $1, 'Suspect', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
             $13, $14, $15, $16, $17, $18, 'Under Investigation', $19
         )
         RETURNING id, case_id, party_type, witness_number, full_name, suspect_id`,
        [
            caseId,
            suspectId,
            fullName || [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Suspect',
            firstName,
            lastName,
            textOrNull(data.alias),
            textOrNull(data.national_id),
            textOrNull(data.phone_number),
            gender,
            textOrNull(data.date_of_birth),
            intOrNull(data.age),
            textOrNull(data.occupation),
            textOrNull(data.ta),
            textOrNull(data.village),
            textOrNull(data.address),
            textOrNull(data.photo_url),
            textOrNull(data.notes),
            createdBy || null
        ]
    );

    return rows[0];
}


async function listParties(caseId) {
    const pool = await db.ready();
    const { rows } = await pool.query(
        `SELECT
             cp.*,
             latest_statement.statement_text AS statement,
             latest_statement.id AS statement_id,
             latest_statement.recorded_at AS statement_recorded_at
         FROM case_parties cp
         LEFT JOIN LATERAL (
             SELECT st.id, st.statement_text, st.recorded_at
             FROM case_statements st
             WHERE st.party_id = cp.id
             ORDER BY st.recorded_at DESC NULLS LAST, st.id DESC
             LIMIT 1
         ) latest_statement ON TRUE
         WHERE cp.case_id = $1
         ORDER BY
             CASE cp.party_type
                 WHEN 'Complainant' THEN 1
                 WHEN 'Witness' THEN 2
                 WHEN 'Suspect' THEN 3
                 ELSE 4
             END,
             cp.witness_number NULLS LAST,
             cp.created_at ASC,
             cp.id ASC`,
        [caseId]
    );

    return rows;
}


async function addParty(caseId, user, data) {
    const partyType = textOrNull(data.party_type) || textOrNull(data.type);

    if (!ADDABLE_PARTY_TYPES.includes(partyType)) {
        return fail(400, 'Select whether you are adding a witness or a suspect.');
    }

    if (partyType === 'Witness' && !textOrNull(data.full_name) && !textOrNull(data.first_name) && !textOrNull(data.last_name)) {
        // allow if full_name present
    }

    if (partyType === 'Witness') {
        const fullName = textOrNull(data.full_name) || ([textOrNull(data.first_name), textOrNull(data.last_name)].filter(Boolean).join(' '));
        if (!fullName) {
            return fail(400, 'Witness full name is required.');
        }
        data.full_name = fullName;
    }

    if (partyType === 'Suspect') {
        const firstName = textOrNull(data.first_name);
        const lastName = textOrNull(data.last_name);
        const gender = textOrNull(data.gender);
        if (!firstName || !lastName || !gender) {
            return fail(400, 'Suspect first name, last name, and gender are required.');
        }
    }

    const pool = await db.ready();
    const { rows: caseRows } = await pool.query('SELECT id FROM cases WHERE id = $1', [caseId]);
    if (caseRows.length === 0) {
        return fail(404, 'Case not found.');
    }

    const isAssigned = await isAssignedInvestigator(caseId, user.id);
    if (!isAssigned && !roleIn(user, PARTY_MANAGE_ROLES)) {
        return fail(403, 'You do not have permission to add parties to this case.');
    }

    const party = await withTransaction(async (client) => {
        const lockedCase = await lockCase(client, caseId);
        if (!lockedCase) {
            throw new Error('Case not found.');
        }

        if (partyType === 'Witness') {
            return createWitnessParty(client, caseId, data, user.id);
        }

        if (partyType === 'Suspect') {
            return createSuspectParty(client, caseId, data, user.id);
        }

        throw new Error('Invalid party type');
    });

    return ok({
        party,
        message: partyType === 'Witness'
            ? `Witness No. ${party.witness_number} added to the case.`
            : `Suspect "${party.full_name}" added to the case.`
    });
}


module.exports = {
    withTransaction,
    createComplainantParty,
    ensureComplainantParty,
    createWitnessParty,
    createSuspectParty,
    listParties,
    addParty,
    nextWitnessNumber
};
