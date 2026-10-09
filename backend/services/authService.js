const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { ok, fail } = require('../utils/result');

const MIN_PASSWORD_LENGTH = 6;


async function findUserByIdentifier(identifier) {
    const [users] = await db.execute(`
        SELECT id, badge_number, rank_title, first_name, last_name, email, password_hash, role, role_id, branch_id, is_active 
        FROM users 
        WHERE badge_number = ? OR email = ?
    `, [identifier, identifier.toLowerCase()]);
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
        branch_id: user.branch_id
    };
}


module.exports = {
    MIN_PASSWORD_LENGTH,
    findUserByIdentifier,
    authenticate,
    changePassword,
    toSessionUser
};
