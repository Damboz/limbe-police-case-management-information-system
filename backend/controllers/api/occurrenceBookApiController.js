const occurrenceBookService = require('../../services/occurrenceBookService');
const { logAudit } = require('../../utils/audit');


exports.list = async (req, res, next) => {
    try {
        const result = await occurrenceBookService.getOccurrenceBook(req.session.user, req.query);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.reopen = async (req, res, next) => {
    try {
        const result = await occurrenceBookService.reopenCase(
            req.session.user,
            req.params.id,
            req.body || {}
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, req.session.user.id, 'CASE_REOPENED', result.auditDetails);

        res.json({ success: true, message: result.message, data: result });
    } catch (err) {
        next(err);
    }
};
