const db = require('../config/db');

// OB numbers are issued per year: OB/0001/2026.
const OB_PREFIX = 'OB';

// Criminal numbers include the station: CR/LIMBE/2026/0001.
const CR_PREFIX = 'CR';
const STATION_CODE = 'LIMBE';

const DEFAULT_PAD = 4;


function pad(value) {
    return String(value).padStart(DEFAULT_PAD, '0');
}


function formatObNumber(year, value) {
    return `${OB_PREFIX}/${pad(value)}/${year}`;
}


function formatCriminalNumber(year, value) {
    return `${CR_PREFIX}/${STATION_CODE}/${year}/${pad(value)}`;
}


// Draw the next value from the yearly counter. The upsert is atomic, so
// concurrent registrations each receive a distinct value without any explicit
// locking. Accepting an optional transaction client lets the allocation roll
// back with the case INSERT it belongs to.
async function allocate(client, type, year) {
    const sql = `
        INSERT INTO number_sequences (year, type, last_number, updated_at)
        VALUES ($1, $2, 1, NOW())
        ON CONFLICT (year, type)
        DO UPDATE SET last_number = number_sequences.last_number + 1, updated_at = NOW()
        RETURNING last_number
    `;

    const result = client && typeof client.query === 'function'
        ? await client.query(sql, [year, type])
        : await db.query(sql, [year, type]);

    return Number(result.rows[0].last_number);
}


async function generateObNumber(client, year = new Date().getFullYear()) {
    const value = await allocate(client, OB_PREFIX, year);
    return formatObNumber(year, value);
}


async function generateCriminalNumber(client, year = new Date().getFullYear()) {
    const value = await allocate(client, CR_PREFIX, year);
    return formatCriminalNumber(year, value);
}


module.exports = {
    formatObNumber,
    formatCriminalNumber,
    allocate,
    generateObNumber,
    generateCriminalNumber
};
