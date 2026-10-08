const branchService = require('../../services/branchService');
const { logAudit } = require('../../utils/audit');


exports.dashboard = async (req, res, next) => {
    try {
        const result = await branchService.getDashboard(req.session.user);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.reviewCase = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await branchService.reviewCase(
            user,
            req.params.id,
            req.body.decision,
            req.body.comment
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'BRANCH_REVIEW_COMPLETED', result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.proposeReassignment = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await branchService.proposeReassignment(
            user,
            req.params.id,
            req.body.current_investigator_id,
            req.body.proposed_investigator_id,
            req.body.reason
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'REASSIGNMENT_PROPOSED', result.auditDetails);

        res.status(201).json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.requestExternalReport = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await branchService.requestExternalReport(
            user,
            req.params.id,
            req.body.report_type,
            req.body.notes
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'EXTERNAL_REPORT_REQUESTED', result.auditDetails);

        res.status(201).json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.markReportReceived = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await branchService.markExternalReportReceived(
            user,
            req.params.reportId,
            req.body.notes
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'EXTERNAL_REPORT_RECEIVED', result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};