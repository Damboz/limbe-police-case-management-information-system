const evidenceService = require('../../services/evidenceService');
const { logAudit } = require('../../utils/audit');


exports.ledger = async (req, res, next) => {
    try {
        const result = await evidenceService.getLedger(req.session.user, req.query);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.updateStatus = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await evidenceService.updateStatus(user, req.params.id, req.body.new_status, req.body.notes);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'EVIDENCE_STATUS_CHANGED', result.auditDetails);

        res.json({
            success: true,
            message: `Evidence item ${result.itemNumber} status updated to "${result.newStatus}".`
        });
    } catch (err) {
        next(err);
    }
};


exports.transfer = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await evidenceService.transfer(user, req.params.id, req.body.transfer_to, req.body.transfer_notes);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'EVIDENCE_TRANSFERRED', result.auditDetails);

        res.json({
            success: true,
            message: `Evidence item ${result.itemNumber} transferred to "${result.destination}".`
        });
    } catch (err) {
        next(err);
    }
};


exports.dispose = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await evidenceService.dispose(user, req.params.id, req.body.disposal_reason);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'EVIDENCE_DISPOSED', result.auditDetails);

        res.json({ success: true, message: `Evidence item ${result.itemNumber} has been disposed.` });
    } catch (err) {
        next(err);
    }
};
