const db = require('../config/db');
const { getClientIp } = require('./http');


async function logAudit(req, userId, action, details) {
    try {
        await db.execute(
            'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [userId || null, action, details, getClientIp(req)]
        );
    } catch (err) {
        console.error(`Failed to write audit log "${action}":`, err.message);
    }
}


module.exports = { logAudit, getClientIp };
