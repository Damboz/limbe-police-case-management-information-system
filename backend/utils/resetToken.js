const crypto = require('crypto');

const TOKEN_TTL_MS = 30 * 60 * 1000;


function getSecret() {
    return process.env.SESSION_SECRET || '';
}


function passwordFingerprint(passwordHash) {
    return crypto.createHash('sha256').update(String(passwordHash || '')).digest('hex').slice(0, 16);
}


function sign(payload) {
    return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}


function createResetToken({ userId, passwordHash }) {
    const payload = Buffer.from(JSON.stringify({
        uid: userId,
        ph: passwordFingerprint(passwordHash),
        exp: Date.now() + TOKEN_TTL_MS
    })).toString('base64url');

    return `${payload}.${sign(payload)}`;
}


function verifyResetToken(token) {
    if (!token || typeof token !== 'string') {
        return null;
    }

    const [payload, signature] = token.split('.');
    if (!payload || !signature) {
        return null;
    }

    const expected = sign(payload);
    const provided = Buffer.from(signature);
    const computed = Buffer.from(expected);
    if (provided.length !== computed.length || !crypto.timingSafeEqual(provided, computed)) {
        return null;
    }

    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        return null;
    }

    if (!data || !data.uid || !data.ph || !data.exp || Date.now() > data.exp) {
        return null;
    }

    return data;
}


module.exports = {
    TOKEN_TTL_MS,
    passwordFingerprint,
    createResetToken,
    verifyResetToken
};
