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
            req.body.notes,
            req.body.court_standing_officer_id
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, result.auditAction, result.auditDetails);

        notifyAssignmentSms(result.caseId, req.body.investigator_ids, req.body.court_standing_officer_id);

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


exports.decideReassignment = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await supervisorService.decideReassignment(
            user,
            req.params.id,
            req.body.decision,
            req.body.decision_note
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, `REASSIGNMENT_${result.decision}`, result.auditDetails);

        // Fire and forget: the reassignment is already committed, so an SMS
        // outage must not turn this into a failed request.
        if (result.reassignedOfficerId) {
            smsService.notifyAssignment({
                officerId: result.reassignedOfficerId,
                caseId: result.caseId,
                role: 'Investigator'
            }).catch(err => console.error('Reassignment SMS notification failed:', err.message));
        }

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.resolveQuery = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await supervisorService.resolveProsecutionQuery(
            user,
            req.params.id,
            req.body.resolution
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'PROSECUTION_QUERY_RESOLVED', result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};
