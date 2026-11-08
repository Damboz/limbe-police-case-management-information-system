const axios = require('axios');
const db = require('../config/db');

const TEXTBEE_BASE_URL = 'https://api.textbee.dev/api/v1';
const REQUEST_TIMEOUT_MS = 15000;


// Malawi mobile numbers are 9 digits after the country code (e.g. 991 234 567).
// Officers may be captured as 0991234567, 991234567, 265991234567 or
// +265991234567. TextBee wants E.164, so always return +265XXXXXXXXX.
function normalisePhone(raw) {
    if (raw === undefined || raw === null) return null;

    let digits = String(raw).trim().replace(/\D/g, '');
    if (!digits) return null;

    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    if (digits.startsWith('265')) {
        // Already in international form.
    } else if (digits.startsWith('0') && digits.length === 10) {
        digits = `265${digits.slice(1)}`;
    } else if (digits.length === 9 && /^[89]/.test(digits)) {
        digits = `265${digits}`;
    }

    if (!/^265[89]\d{8}$/.test(digits)) return null;
    return `+${digits}`;
}


function formatCourtDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return raw;

    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}


// Keep it short and free of case facts: an SMS can be seen by anyone holding
// the officer's phone, so it only says who to contact and which case to open.
function buildMessage(role, obNumber, officerName, courtDate) {
    const name = officerName || 'Officer';
    const reference = obNumber || 'the assigned case';
    let message = `Limbe Police CMIS: ${name}, you are assigned as ${role} on case ${reference}.`;

    const date = formatCourtDate(courtDate);
    if (date) message += ` Court date: ${date}.`;

    message += ' Please log in to review.';
    return message;
}


function providerError(err) {
    const body = err && err.response && err.response.data;
    if (body) {
        if (typeof body === 'string') return body;
        if (body.error) return body.error;
        if (body.message) return body.message;
    }
    return err && err.message ? err.message : String(err);
}


async function sendViaTextBee(phone, message) {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;

    if (!apiKey || !deviceId) {
        return { sent: false, error: 'SMS service is not configured (TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID missing).' };
    }

    try {
        // Current TextBee API: POST /gateway/send-sms with the device chosen by
        // the `deviceId` body field (the older /gateway/devices/:id/send-sms
        // path is no longer documented).
        const response = await axios.post(
            `${TEXTBEE_BASE_URL}/gateway/send-sms`,
            {
                recipients: [phone],
                message,
                deviceId
            },
            {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: REQUEST_TIMEOUT_MS
            }
        );

        const data = (response.data && response.data.data) || {};

        if (data.success === false) {
            return { sent: false, error: data.message || 'TextBee rejected the message.' };
        }

        return {
            sent: true,
            batchId: data.smsBatchId || null,
            warning: data.warning && data.warning.message ? data.warning.message : null
        };
    } catch (err) {
        return { sent: false, error: providerError(err) };
    }
}


async function markNotification(id, status, error) {
    try {
        await db.execute(
            `UPDATE sms_notifications
             SET status = ?,
                 error = ?,
                 sent_at = CASE WHEN ? = 'SENT' THEN NOW() ELSE sent_at END
             WHERE id = ?`,
            [status, error || null, status, id]
        );
    } catch (err) {
        console.error('Failed to update SMS notification:', err.message);
    }
}


// Every attempt is recorded first as PENDING, then updated to SENT or FAILED.
// Provider problems never throw: an SMS is a courtesy notification and must not
// break the assignment that triggered it.
async function notifyAssignment({ officerId, caseId, role, courtDate } = {}) {
    if (!officerId || !caseId || !role) {
        return { sent: false, error: 'officerId, caseId and role are required.' };
    }

    let notificationId = null;

    try {
        const [officerRows] = await db.execute(
            `SELECT id, badge_number, rank_title, first_name, last_name, phone_number
             FROM users WHERE id = ?`,
            [officerId]
        );
        const [caseRows] = await db.execute(
            'SELECT id, ob_number, court_date FROM cases WHERE id = ?',
            [caseId]
        );

        if (officerRows.length === 0) {
            return { sent: false, error: 'Officer not found.' };
        }
        if (caseRows.length === 0) {
            return { sent: false, error: 'Case not found.' };
        }

        const officer = officerRows[0];
        const caseItem = caseRows[0];
        const storedPhone = normalisePhone(officer.phone_number) || officer.phone_number || null;
        const officerName = `${officer.rank_title || ''} ${officer.first_name || ''} ${officer.last_name || ''}`.trim() || officer.badge_number || 'Officer';
        // A resent court notification has no courtDate argument, so fall back to
        // the date already stored on the case.
        const message = buildMessage(role, caseItem.ob_number, officerName, courtDate || caseItem.court_date);

        const [insert] = await db.execute(
            `INSERT INTO sms_notifications (case_id, officer_id, role, phone, message, status)
             VALUES (?, ?, ?, ?, ?, 'PENDING')`,
            [caseId, officerId, role, storedPhone, message]
        );
        notificationId = insert.insertId;

        const phone = normalisePhone(officer.phone_number);
        if (!phone) {
            const error = 'Officer has no valid Malawi mobile number on file.';
            await markNotification(notificationId, 'FAILED', error);
            return { id: notificationId, sent: false, status: 'FAILED', error, phone: storedPhone };
        }

        const result = await sendViaTextBee(phone, message);

        if (!result.sent) {
            await markNotification(notificationId, 'FAILED', result.error);
            return { id: notificationId, sent: false, status: 'FAILED', error: result.error, phone };
        }

        await markNotification(notificationId, 'SENT', result.warning);
        return {
            id: notificationId,
            sent: true,
            status: 'SENT',
            warning: result.warning,
            batchId: result.batchId,
            phone
        };
    } catch (err) {
        if (notificationId) {
            await markNotification(notificationId, 'FAILED', err.message);
        }
        return { id: notificationId, sent: false, status: 'FAILED', error: err.message };
    }
}


async function listNotifications(caseId) {
    const [rows] = await db.execute(`
        SELECT sn.id, sn.case_id, sn.officer_id, sn.role, sn.phone, sn.message,
               sn.status, sn.error, sn.created_at, sn.sent_at,
               u.badge_number,
               CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS officer_name
        FROM sms_notifications sn
        LEFT JOIN users u ON u.id = sn.officer_id
        WHERE sn.case_id = ?
        ORDER BY sn.created_at DESC, sn.id DESC
    `, [caseId]);
    return rows;
}


async function getNotification(caseId, notificationId) {
    const [rows] = await db.execute(
        `SELECT id, case_id, officer_id, role, phone, message, status
         FROM sms_notifications
         WHERE id = ? AND case_id = ?`,
        [notificationId, caseId]
    );
    return rows[0] || null;
}


module.exports = {
    normalisePhone,
    // Kept as an alias for callers that used the old service name.
    normalisePhoneNumber: normalisePhone,
    buildMessage,
    sendViaTextBee,
    notifyAssignment,
    listNotifications,
    getNotification
};
