const supervisorService = require('../../services/supervisorService');
const { logAudit } = require('../../utils/audit');


exports.dashboard = async (req, res, next) => {
    try {
        const result = await supervisorService.getDashboard();
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.assignCase = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await supervisorService.assignCase(
            user,
            req.body.case_id,
            req.body.investigator_ids,
            req.body.notes
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, result.auditAction, result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.approveStatus = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await supervisorService.processStatusApproval(
            user,
            req.body.case_id,
            req.body.decision,
            req.body.supervisor_notes
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, `STATUS_APPROVAL_${result.decision}`, result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.analytics = async (req, res, next) => {
    try {
        const result = await supervisorService.getAnalytics();
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.hotspots = async (req, res, next) => {
    try {
        const result = await supervisorService.getHotspotsDetail();
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.categories = async (req, res, next) => {
    try {
        const result = await supervisorService.getCategoryBreakdownDetail();
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};
