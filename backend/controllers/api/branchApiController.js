const branchService = require('../../services/branchService');
const supervisorService = require('../../services/supervisorService');
const smsService = require('../../services/smsService');
const { logAudit } = require('../../utils/audit');


// SMS is a courtesy side effect: never await it in the request path and never
// let a provider failure turn a successful assignment into an error response.
function notifyAssignmentSms(caseId, investigatorIds, courtOfficerId) {
    const rawIds = Array.isArray(investigatorIds) ? investigatorIds : [investigatorIds];
    const officerIds = [...new Set(rawIds.filter(Boolean).map(String))];

    for (const officerId of officerIds) {
        smsService.notifyAssignment({ officerId, caseId, role: 'Investigator' })
            .catch(err => console.error('Investigator SMS notification failed:', err.message));
    }

    if (courtOfficerId) {
        smsService.notifyAssignment({ officerId: courtOfficerId, caseId, role: 'Court Standing Officer' })
            .catch(err => console.error('Court officer SMS notification failed:', err.message));
    }
}


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

        await logAudit(req, user.id, result.auditAction || 'BRANCH_REVIEW_COMPLETED', result.auditDetails);

        res.json({ success: true, message: result.message });
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
            req.body.notes,
            req.body.court_standing_officer_id
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, result.auditAction, result.auditDetails);

        notifyAssignmentSms(result.caseId, req.body.investigator_ids, req.body.court_standing_officer_id);

        res.status(201).json({ success: true, message: result.message });
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