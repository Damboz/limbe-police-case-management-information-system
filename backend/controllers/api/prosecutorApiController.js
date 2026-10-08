const prosecutorService = require('../../services/prosecutorService');
const { logAudit } = require('../../utils/audit');


exports.dashboard = async (req, res, next) => {
    try {
        const result = await prosecutorService.getDashboard(req.session.user);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.acknowledge = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await prosecutorService.acknowledgeReceipt(
            user,
            req.params.id,
            req.body.file_location,
            req.body.notes
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'FILE_RECEIVED', result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.fileLocation = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await prosecutorService.updateFileLocation(
            user,
            req.params.id,
            req.body.file_location
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'FILE_LOCATION_UPDATED', result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.court = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await prosecutorService.recordCourtDetails(
            user,
            req.params.id,
            req.body.court_date,
            req.body.court_outcome
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'COURT_DETAILS_RECORDED', result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};


exports.query = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await prosecutorService.sendQueryToStation(
            user,
            req.params.id,
            req.body.query
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'PROSECUTION_QUERY_SENT', result.auditDetails);

        res.status(201).json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};