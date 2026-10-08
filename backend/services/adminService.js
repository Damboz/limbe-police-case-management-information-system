const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { ok, fail } = require('../utils/result');

const MIN_PASSWORD_LENGTH = 6;


function getRoleMapping(roleInput) {
    const input = (roleInput || '').toString().toLowerCase().trim();

    switch (input) {
        case 'admin':
            return { role: 'Admin', role_id: 1 };
        case 'station commander':
        case 'supervisor':
            return { role: 'Station Commander', role_id: 2 };
        case 'investigating officer':
        case 'investigator':
            return { role: 'Investigating Officer', role_id: 3 };
        case 'counter/intake officer':
        case 'officer':
            return { role: 'Counter/Intake Officer', role_id: 4 };
        case 'branch in-charge':
        case 'branch officer':
        case 'branch':
        case 'branchincharge':
            return { role: 'Branch In-charge', role_id: 5 };
        case 'prosecutor':
            return { role: 'Prosecutor', role_id: 6 };
        default:
            return { role: 'Counter/Intake Officer', role_id: 4 };
    }
}


async function getAdminDashboard() {
    const [[{ total_users }]] = await db.execute('SELECT COUNT(*) AS total_users FROM users');
    const [[{ active_users }]] = await db.execute('SELECT COUNT(*) AS active_users FROM users WHERE is_active = 1');
    const [[{ total_logins }]] = await db.execute("SELECT COUNT(*) AS total_logins FROM audit_logs WHERE action = 'USER_LOGIN'");

    const [users] = await db.execute(`
        SELECT id, badge_number, rank_title, first_name, last_name, email, role, role_id, is_active 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5
    `);

    const [recentLogs] = await db.execute(`
        SELECT a.*, u.badge_number, u.first_name, u.last_name 
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC 
        LIMIT 10
    `);

    return ok({
        stats: { totalUsers: total_users, activeUsers: active_users, totalLogins: total_logins },
        users,
        recentLogs
    });
}


async function getUsers(query) {
    const search = query.search ? `%${query.search.trim()}%` : '%';
    const roleFilter = query.role || '';

    let sql = `
        SELECT u.id, u.badge_number, u.rank_title, u.first_name, u.last_name, u.email, 
               u.role, u.role_id, u.phone_number, u.is_active, u.created_at,
               su.name AS branch_name
        FROM users u
        LEFT JOIN station_branch su ON u.branch_id = su.id
        WHERE (u.badge_number LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)
    `;
    const params = [search, search, search, search];

    if (roleFilter) {
        sql += ` AND u.role_id = ?`;
        params.push(roleFilter);
    }

    sql += ` ORDER BY u.created_at DESC`;

    const [users] = await db.execute(sql, params);

    return ok({
        users,
        searchQuery: query.search || '',
        roleFilter
    });
}


async function getPersonnelFormOptions() {
    const [roles] = await db.execute('SELECT * FROM roles ORDER BY id ASC');
    const [branches] = await db.execute('SELECT * FROM station_branch ORDER BY name ASC');
    return { roles, branches };
}


async function getUserToEdit(userId) {
    const [users] = await db.execute(
        'SELECT id, badge_number, rank_title, first_name, last_name, email, phone_number, role, role_id, branch_id, is_active FROM users WHERE id = ?',
        [userId]
    );
    if (users.length === 0) {
        return fail(404, 'User account not found.');
    }
    return ok({ userToEdit: users[0] });
}


async function createUser(body) {
    const { badge_number, rank_title, first_name, last_name, email, phone_number, role, branch_id, password } = body;

    if (!badge_number || !first_name || !last_name || !email || !role || !password) {
        return fail(400, 'Please complete all required fields.');
    }

    const [existing] = await db.execute(
        'SELECT id FROM users WHERE badge_number = ? OR email = ?',
        [badge_number.trim(), email.trim().toLowerCase()]
    );

    if (existing.length > 0) {
        return fail(400, 'An officer with this Badge Number or Email already exists.');
    }

    const roleMap = getRoleMapping(role);
    const parsedBranchId = branch_id ? parseInt(branch_id, 10) : null;

    if (roleMap.role_id === 5 && !parsedBranchId) {
        return fail(400, 'Please select the branch that this Branch In-charge heads.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.execute(`
        INSERT INTO users (
            badge_number, rank_title, first_name, last_name, email, 
            phone_number, role, role_id, branch_id, password_hash, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
        badge_number.trim(),
        rank_title ? rank_title.trim() : null,
        first_name.trim(),
        last_name.trim(),
        email.trim().toLowerCase(),
        phone_number ? phone_number.trim() : null,
        roleMap.role,
        roleMap.role_id,
        parsedBranchId,
        hashedPassword
    ]);

    return ok({
        userId: result.insertId,
        badgeNumber: badge_number.trim(),
        firstName: first_name.trim(),
        lastName: last_name.trim(),
        auditDetails: `Created user ${badge_number.trim()} with role ${roleMap.role} (Role ID: ${roleMap.role_id})`
    });
}


async function updateUser(userId, body) {
    const { rank_title, first_name, last_name, email, phone_number, role, branch_id } = body;

    if (!first_name || !last_name || !email || !role) {
        return fail(400, 'First Name, Last Name, Email, and Role are required fields.');
    }

    const [existing] = await db.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email.trim().toLowerCase(), userId]
    );

    if (existing.length > 0) {
        return fail(400, 'The provided email is already registered to another account.');
    }

    const roleMap = getRoleMapping(role);
    const parsedBranchId = branch_id ? parseInt(branch_id, 10) : null;

    if (roleMap.role_id === 5 && !parsedBranchId) {
        return fail(400, 'Please select the branch that this Branch In-charge heads.');
    }

    await db.execute(`
        UPDATE users 
        SET rank_title = ?, first_name = ?, last_name = ?, email = ?, phone_number = ?, role = ?, role_id = ?, branch_id = ?
        WHERE id = ?
    `, [
        rank_title ? rank_title.trim() : null,
        first_name.trim(),
        last_name.trim(),
        email.trim().toLowerCase(),
        phone_number ? phone_number.trim() : null,
        roleMap.role,
        roleMap.role_id,
        parsedBranchId,
        userId
    ]);

    return ok({
        firstName: first_name.trim(),
        lastName: last_name.trim(),
        auditDetails: `Updated details for User ID ${userId} (${first_name} ${last_name}). Assigned Role: ${roleMap.role}`
    });
}


async function resetPassword(userId, newPassword, confirmPassword) {
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
        return fail(400, 'Password must be at least 6 characters long.');
    }

    if (newPassword !== confirmPassword) {
        return fail(400, 'Passwords do not match.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);

    return ok({ userId, auditDetails: `Admin reset password for User ID ${userId}` });
}


async function toggleUserStatus(actingUser, userId) {
    if (actingUser && parseInt(userId, 10) === parseInt(actingUser.id, 10)) {
        return fail(400, 'You cannot deactivate your own active account.');
    }

    const [users] = await db.execute('SELECT is_active, badge_number, first_name, last_name FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
        return fail(404, 'User account not found.');
    }

    const target = users[0];
    const newStatus = target.is_active ? 0 : 1;
    await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);

    return ok({
        userId,
        isActive: Boolean(newStatus),
        badgeNumber: target.badge_number,
        auditDetails: `Toggled status for ${target.badge_number} to ${newStatus ? 'Active' : 'Inactive'}`,
        message: `Account for ${target.first_name} ${target.last_name} (${target.badge_number}) updated to ${newStatus ? 'Active' : 'Inactive'}.`
    });
}


async function deleteUser(actingUser, userId) {
    if (actingUser && parseInt(userId, 10) === parseInt(actingUser.id, 10)) {
        return fail(400, 'You cannot delete your own account.');
    }

    const [users] = await db.execute(
        'SELECT is_active, badge_number, first_name, last_name, role FROM users WHERE id = ?',
        [userId]
    );
    if (users.length === 0) {
        return fail(404, 'User account not found.');
    }

    const target = users[0];
    if (target.is_active) {
        return fail(400, `Account ${target.badge_number} is active. Only deactivated (inactive) accounts can be deleted.`);
    }

    const [refs] = await db.execute(`
        SELECT
            (SELECT COUNT(*) FROM cases                  WHERE intake_officer_id = ?)          AS intake_cases,
            (SELECT COUNT(*) FROM evidence               WHERE collected_by_officer_id = ?)     AS evidence_records,
            (SELECT COUNT(*) FROM case_notes             WHERE officer_id = ?)                  AS case_notes,
            (SELECT COUNT(*) FROM case_minutes           WHERE author_id = ?)                   AS case_minutes,
            (SELECT COUNT(*) FROM external_reports       WHERE requested_by = ?)                AS external_reports,
            (SELECT COUNT(*) FROM case_custody_log       WHERE handed_over_by = ?)              AS custody_handovers,
            (SELECT COUNT(*) FROM case_custody_log       WHERE received_by = ?)                 AS custody_receipts,
            (SELECT COUNT(*) FROM reassignment_proposals WHERE proposed_by = ?)                 AS proposed_reassignments,
            (SELECT COUNT(*) FROM reassignment_proposals WHERE proposed_investigator_id = ?)    AS reassignment_targets
    `, [userId, userId, userId, userId, userId, userId, userId, userId, userId]);

    const intakeCases = refs[0]?.intake_cases || 0;
    const evidenceRecords = refs[0]?.evidence_records || 0;
    const notesCount = refs[0]?.case_notes || 0;
    const minutesCount = refs[0]?.case_minutes || 0;
    const externalReports = refs[0]?.external_reports || 0;
    const custodyHandovers = refs[0]?.custody_handovers || 0;
    const custodyReceipts = refs[0]?.custody_receipts || 0;
    const proposedReassignments = refs[0]?.proposed_reassignments || 0;
    const reassignmentTargets = refs[0]?.reassignment_targets || 0;

    if (intakeCases > 0 || evidenceRecords > 0 || notesCount > 0 || minutesCount > 0
        || externalReports > 0 || custodyHandovers > 0 || custodyReceipts > 0
        || proposedReassignments > 0 || reassignmentTargets > 0) {
        return fail(400, `Cannot delete ${target.badge_number} — the account has historical records (${intakeCases} case(s) as intake officer, ${evidenceRecords} evidence record(s), ${notesCount} case note(s), ${minutesCount} minute(s), ${externalReports} external report request(s), ${custodyHandovers} custody handover(s), ${custodyReceipts} custody receipt(s), ${proposedReassignments} reassignment proposal(s), ${reassignmentTargets} reassignment target(s)). Deactivate instead.`);
    }

    await db.execute('DELETE FROM users WHERE id = ?', [userId]);

    return ok({
        userId,
        auditDetails: `Deleted deactivated account ${target.badge_number} (${target.role || 'No Role'})`,
        message: `Account ${target.badge_number} (${target.first_name} ${target.last_name}) has been permanently deleted.`
    });
}


async function clearAuditLogs() {
    await db.execute(`DELETE FROM audit_logs`);
    return ok({});
}


async function getAuditLogs(query) {
    const search = query.search ? `%${query.search.trim()}%` : '';
    const actionFilter = query.action || '';
    const roleFilter = query.role || '';
    const dateFrom = query.date_from || '';
    const dateTo = query.date_to || '';

    const conditions = ['1=1'];
    const params = [];

    if (search) {
        conditions.push('(a.details LIKE ? OR u.badge_number LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)');
        params.push(search, search, search, search);
    }
    if (actionFilter) {
        conditions.push('a.action = ?');
        params.push(actionFilter);
    }
    if (roleFilter) {
        conditions.push('u.role = ?');
        params.push(roleFilter);
    }
    if (dateFrom) {
        conditions.push('DATE(a.created_at) >= ?');
        params.push(dateFrom);
    }
    if (dateTo) {
        conditions.push('DATE(a.created_at) <= ?');
        params.push(dateTo);
    }

    const whereClause = conditions.join(' AND ');

    const [logs] = await db.execute(`
        SELECT a.*, u.badge_number, u.rank_title, u.first_name, u.last_name, u.role
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT 500
    `, params);

    const [actionTypes] = await db.execute(`
        SELECT DISTINCT action FROM audit_logs ORDER BY action ASC
    `);

    const [roleTypes] = await db.execute(`
        SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role ASC
    `);

    return ok({
        logs,
        actionTypes: actionTypes.map(r => r.action),
        roleTypes: roleTypes.map(r => r.role),
        filters: {
            search: query.search || '',
            action: actionFilter,
            role: roleFilter,
            date_from: dateFrom,
            date_to: dateTo
        }
    });
}


module.exports = {
    getRoleMapping,
    getAdminDashboard,
    getUsers,
    getPersonnelFormOptions,
    getUserToEdit,
    createUser,
    updateUser,
    resetPassword,
    toggleUserStatus,
    deleteUser,
    clearAuditLogs,
    getAuditLogs
};
