const db = require('../config/db');
const bcrypt = require('bcryptjs');
const emailService = require('./emailService');
const { TOKEN_TTL_MS, passwordFingerprint, createResetToken, verifyResetToken } = require('../utils/resetToken');
const { ok, fail } = require('../utils/result');

const MIN_PASSWORD_LENGTH = 6;


async function findUserByIdentifier(identifier) {
    const [users] = await db.execute(`
        SELECT id, badge_number, rank_title, first_name, last_name, email, password_hash, role, role_id, branch_id, branch, is_active 
        FROM users 
        WHERE badge_number = ? OR LOWER(email) = ?
    `, [identifier, identifier.toLowerCase()]);
    return users[0] || null;
}


async function findUserById(id) {
    const [users] = await db.execute(`
        SELECT id, badge_number, rank_title, first_name, last_name, email, password_hash, role, role_id, branch_id, branch, is_active 
        FROM users 
        WHERE id = ?
    `, [id]);
    return users[0] || null;
}


async function authenticate(badgeNumber, password) {
    if (!badgeNumber || !password) {
        return fail(400, 'Please provide both Badge Number / Username and Password.');
    }

    const identifier = badgeNumber.trim();
    const user = await findUserByIdentifier(identifier);

    if (!user) {
        return fail(401, 'Invalid credentials. Please verify your badge number or email.');
    }

    if (!user.is_active) {
        return fail(403, 'Account deactivated. Please contact your System Administrator.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        return fail(401, 'Invalid credentials. Please check your password.');
    }

    return ok({ user: toSessionUser(user) });
}


// Re-read the account behind a signed session cookie and rebuild the session
// projection from the database. The cookie is a snapshot taken at login, so
// without this an officer who is deactivated, deleted or moved to another role
// would keep their old privileges until the cookie expires. Returns null when
// the account no longer exists or is inactive, which forces a fresh login.
async function refreshSessionUser(sessionUser) {
    if (!sessionUser || sessionUser.id === undefined || sessionUser.id === null) {
        return null;
    }

    const user = await findUserById(sessionUser.id);
    if (!user || !user.is_active) {
        return null;
    }

    return toSessionUser(user);
}


async function changePassword(user, currentPassword, newPassword, confirmPassword) {
    if (!currentPassword || !newPassword || !confirmPassword) {
        return fail(400, 'All password fields are required.');
    }

    if (newPassword !== confirmPassword) {
        return fail(400, 'New password and confirmation password do not match.');
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return fail(400, 'New password must be at least 6 characters long.');
    }

    const [users] = await db.execute('SELECT password_hash, badge_number FROM users WHERE id = ?', [user.id]);
    if (users.length === 0) {
        return fail(401, 'User account not found.');
    }

    const record = users[0];

    const isMatch = await bcrypt.compare(currentPassword, record.password_hash);
    if (!isMatch) {
        return fail(400, 'Incorrect current password.');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedNewPassword, user.id]);

    return ok({ badgeNumber: record.badge_number });
}


// Send a password-reset link to the account that owns the given email address.
// The response is deliberately identical whether or not the address exists, so
// the endpoint cannot be used to discover which emails are registered.
async function requestPasswordReset(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) {
        return fail(400, 'Please enter your registered email address.');
    }

    const [users] = await db.execute(
        'SELECT id, badge_number, first_name, last_name, email, password_hash, is_active FROM users WHERE LOWER(email) = ?',
        [normalized]
    );

    const user = users[0];
    if (!user || !user.is_active) {
        return ok({ delivered: false });
    }

    const token = createResetToken({ userId: user.id, passwordHash: user.password_hash });

    let emailStatus;
    try {
        emailStatus = await emailService.sendAccountSetupEmail({
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            badgeNumber: user.badge_number,
            token,
            expiresMinutes: Math.round(TOKEN_TTL_MS / 60000),
            purpose: 'reset'
        });
    } catch (err) {
        emailStatus = { sent: false, error: err.message };
    }

    return ok({
        delivered: Boolean(emailStatus && emailStatus.sent),
        error: emailStatus && !emailStatus.sent ? emailStatus.error : null
    });
}


// Complete a reset started by requestPasswordReset. The token is stateless and
// bound to the password hash that was current when it was issued, so it becomes
// unusable the moment the password changes (single use) or once it expires.
async function resetPasswordWithToken(token, newPassword, confirmPassword) {
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
        return fail(400, 'Password must be at least 6 characters long.');
    }

    if (newPassword !== confirmPassword) {
        return fail(400, 'Password and confirmation password do not match.');
    }

    const data = verifyResetToken(token);
    if (!data) {
        return fail(400, 'This password reset link is invalid or has expired. Please request a new one.');
    }

    const [users] = await db.execute(
        'SELECT id, badge_number, password_hash FROM users WHERE id = ?',
        [data.uid]
    );

    if (users.length === 0 || passwordFingerprint(users[0].password_hash) !== data.ph) {
        return fail(400, 'This password reset link is invalid or has already been used. Please request a new one.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, users[0].id]);

    return ok({ badgeNumber: users[0].badge_number });
}


function toSessionUser(user) {
    return {
        id: user.id,
        badge_number: user.badge_number,
        rank_title: user.rank_title,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        role_id: user.role_id,
        branch_id: user.branch_id,
        branch: user.branch
    };
}


module.exports = {
    MIN_PASSWORD_LENGTH,
    findUserByIdentifier,
    findUserById,
    authenticate,
    refreshSessionUser,
    changePassword,
    requestPasswordReset,
    resetPasswordWithToken,
    toSessionUser
};
