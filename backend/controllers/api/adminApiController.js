const adminService = require('../../services/adminService');
const { logAudit } = require('../../utils/audit');


exports.dashboard = async (req, res, next) => {
    try {
        const result = await adminService.getAdminDashboard();
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.users = async (req, res, next) => {
    try {
        const result = await adminService.getUsers(req.query);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.formOptions = async (req, res, next) => {
    try {
        const data = await adminService.getPersonnelFormOptions();
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};


exports.editUser = async (req, res, next) => {
    try {
        const result = await adminService.getUserToEdit(req.params.id);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        const options = await adminService.getPersonnelFormOptions();
        res.json({ success: true, data: { ...result, ...options } });
    } catch (err) {
        next(err);
    }
};


exports.createUser = async (req, res, next) => {
    try {
        const adminId = req.session.user.id;
        const result = await adminService.createUser(req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, adminId, 'USER_CREATED', result.auditDetails);

        res.status(201).json({
            success: true,
            message: `Officer ${result.firstName} ${result.lastName} (${result.badgeNumber}) registered successfully.`,
            data: { userId: result.userId }
        });
    } catch (err) {
        next(err);
    }
};


exports.updateUser = async (req, res, next) => {
    try {
        const adminId = req.session.user.id;
        const result = await adminService.updateUser(req.params.id, req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, adminId, 'USER_UPDATED', result.auditDetails);

        res.json({ success: true, message: `User profile for ${result.firstName} ${result.lastName} updated successfully.` });
    } catch (err) {
        next(err);
    }
};


exports.resetPassword = async (req, res, next) => {
    try {
        const adminId = req.session.user.id;
        const result = await adminService.resetPassword(req.params.id, req.body.new_password, req.body.confirm_password);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, adminId, 'PASSWORD_RESET', result.auditDetails);

        res.json({ success: true, message: 'User password reset successfully.' });
    } catch (err) {
        next(err);
    }
};


exports.toggleStatus = async (req, res, next) => {
    try {
        const adminId = req.session.user.id;
        const result = await adminService.toggleUserStatus(req.session.user, req.params.id);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, adminId, 'STATUS_CHANGE', result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.deleteUser = async (req, res, next) => {
    try {
        const adminId = req.session.user.id;
        const result = await adminService.deleteUser(req.session.user, req.params.id);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, adminId, 'USER_DELETED', result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.auditLogs = async (req, res, next) => {
    try {
        const result = await adminService.getAuditLogs(req.query);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.clearAuditLogs = async (req, res, next) => {
    try {
        const currentUser = req.session.user;
        await adminService.clearAuditLogs();

        await logAudit(
            req,
            currentUser ? currentUser.id : null,
            'LOGS_CLEARED',
            currentUser
                ? `Security and audit trail logs cleared by ${currentUser.badge_number || 'Administrator'}.`
                : 'Security and audit trail logs cleared.'
        );

        res.json({ success: true, message: 'All security and audit logs have been cleared.' });
    } catch (err) {
        next(err);
    }
};
