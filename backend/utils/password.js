const crypto = require('crypto');

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(chars) {
    return chars[crypto.randomInt(chars.length)];
}

// A temporary password used only until the officer sets their own via the
// emailed setup link. Guaranteed to contain at least one of each character
// class so it passes any basic complexity requirement.
function generateRandomPassword(length = 16) {
    const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
    const rest = Array.from({ length: Math.max(length, required.length) - required.length }, () => pick(ALL));
    const chars = [...required, ...rest];

    for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = crypto.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
}


module.exports = {
    generateRandomPassword
};
