const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const SENDER_NAME = 'Limbe Police Station CMS';
const REQUEST_TIMEOUT_MS = 20000;


function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


function getLoginUrl() {
    return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}


function renderLayout(bodyHtml) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:24px 0;">
        <tr><td align="center">
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #dfe4ea;">
                <tr>
                    <td style="background:#0b3d6b;padding:20px 28px;">
                        <h1 style="margin:0;color:#ffffff;font-size:18px;">Limbe Police Station</h1>
                        <p style="margin:4px 0 0;color:#c9dcf0;font-size:13px;">Case Management Information System</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:28px;">
${bodyHtml}
                    </td>
                </tr>
                <tr>
                    <td style="background:#f7f9fc;padding:16px 28px;border-top:1px solid #dfe4ea;">
                        <p style="margin:0;font-size:12px;color:#8899aa;">
                            This is an automated message from the Limbe Police Station Case Management Information System. Please do not reply to this email.
                        </p>
                    </td>
                </tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`.trim();
}


function renderDetailsTable(rows) {
    const cells = rows.map((row, index) => {
        const border = index < rows.length - 1 ? 'border-bottom:1px solid #e6ebf2;' : '';
        return `
                            <tr>
                                <td style="padding:12px 16px;${border}width:150px;color:#667788;font-size:13px;">${escapeHtml(row.label)}</td>
                                <td style="padding:12px 16px;${border}font-size:14px;color:#111111;font-weight:bold;">${escapeHtml(row.value)}</td>
                            </tr>`;
    }).join('');

    return `
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border:1px solid #dfe4ea;border-radius:6px;margin-bottom:20px;">${cells}
                        </table>`;
}


function buildAccountSetupEmail({ firstName, lastName, badgeNumber, email, token, expiresMinutes, purpose }) {
    const isReset = purpose === 'reset';
    const fullName = `${firstName} ${lastName}`;
    const setupUrl = `${getLoginUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    const intro = isReset
        ? `A password reset was requested for your Limbe Police Station Case Management Information System account. Click the button below to choose a new password.`
        : `Your account on the Limbe Police Station Case Management Information System has been created. Click the button below to set the password you will use to sign in.`;

    const closing = isReset
        ? `If you did not request a password reset, you can safely ignore this email — your password will not change.`
        : `Until you set your password, the account cannot be used to sign in. Please do not share this link with anyone.`;

    const rows = [{ label: 'Badge Number', value: badgeNumber }];
    if (email) {
        rows.push({ label: 'Email', value: email });
    }

    const bodyHtml = `
                        <p style="margin:0 0 16px;font-size:14px;color:#333333;">Dear ${escapeHtml(fullName)},</p>
                        <p style="margin:0 0 16px;font-size:14px;color:#333333;">${escapeHtml(intro)}</p>${renderDetailsTable(rows)}
                        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
                            <tr>
                                <td style="border-radius:6px;background:#0b3d6b;">
                                    <a href="${escapeHtml(setupUrl)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">${isReset ? 'Reset My Password' : 'Set My Password'}</a>
                                </td>
                            </tr>
                        </table>
                        <p style="margin:0 0 8px;font-size:13px;color:#555555;">
                            This link will expire in <strong>${escapeHtml(String(expiresMinutes))} minutes</strong> and can only be used once.
                            If the button does not work, copy and paste this address into your browser:
                        </p>
                        <p style="margin:0 0 20px;font-size:12px;color:#0b3d6b;word-break:break-all;">${escapeHtml(setupUrl)}</p>
                        <p style="margin:0 0 4px;font-size:13px;color:#555555;">${escapeHtml(closing)}</p>`;

    return {
        subject: isReset
            ? 'Reset your Limbe Police Station CMS password'
            : 'Set your Limbe Police Station CMS password',
        htmlContent: renderLayout(bodyHtml)
    };
}


async function sendEmail({ to, toName, subject, htmlContent }) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;

    if (!apiKey || !senderEmail) {
        return {
            sent: false,
            error: 'Email service is not configured (BREVO_API_KEY or BREVO_SENDER_EMAIL missing).'
        };
    }

    if (!to) {
        return { sent: false, error: 'No recipient email address on file.' };
    }

    const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            sender: { name: SENDER_NAME, email: senderEmail },
            to: [{ email: to.trim().toLowerCase(), name: toName }],
            subject,
            htmlContent
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
        let detail = '';
        try {
            const body = await response.json();
            detail = body?.message || JSON.stringify(body);
        } catch {
            detail = await response.text().catch(() => '');
        }
        return { sent: false, error: `Brevo API error (${response.status})${detail ? `: ${detail}` : ''}` };
    }

    return { sent: true };
}


// purpose: 'created' for a brand-new account, 'reset' for an admin-initiated reset.
async function sendAccountSetupEmail({ email, firstName, lastName, badgeNumber, token, expiresMinutes, purpose }) {
    const { subject, htmlContent } = buildAccountSetupEmail({
        firstName, lastName, badgeNumber, email, token, expiresMinutes, purpose
    });
    return sendEmail({ to: email, toName: `${firstName} ${lastName}`, subject, htmlContent });
}


module.exports = {
    sendAccountSetupEmail
};
