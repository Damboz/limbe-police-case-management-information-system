const { ok, fail } = require('../utils/result');
const numberService = require('./numberService');

// Numbering is now automatic at registration. These generators are kept as a
// thin compatibility layer for any remaining callers; new code should import
// numberService directly.
async function generateObNumber(client, year) {
    return numberService.generateObNumber(client, year);
}


async function generateCriminalNumber(client, year) {
    return numberService.generateCriminalNumber(client, year);
}


// The separate numbering desk was retired when numbers moved into the
// registration transaction. Kept so either stale link or an old client gets a
// clear message instead of a 404.
async function getRecordsDashboard() {
    return fail(410, 'The numbering desk has been retired because numbers are now assigned automatically at registration.');
}


async function assignCaseNumbers() {
    return fail(410, 'Numbers are assigned automatically at registration; manual numbering is no longer available.');
}


module.exports = {
    generateObNumber,
    generateCriminalNumber,
    getRecordsDashboard,
    assignCaseNumbers
};
