function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || null;
}

function wantsJson(req) {
    // Inside a mounted router req.path has the mount prefix stripped, so match on
    // originalUrl/baseUrl to guarantee /api requests always answer with JSON.
    const url = req.originalUrl || req.url || '';
    if (req.baseUrl === '/api' || url === '/api' || url.startsWith('/api/') || url.startsWith('/api?')) {
        return true;
    }
    if (req.xhr) {
        return true;
    }
    const accept = req.headers.accept || '';
    if (accept.includes('application/json')) {
        return true;
    }
    if (accept.includes('text/html')) {
        return false;
    }
    return req.accepts(['html', 'json']) === 'json';
}

module.exports = { getClientIp, wantsJson };
