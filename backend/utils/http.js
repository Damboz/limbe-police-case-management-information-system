function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || null;
}

module.exports = { getClientIp };
