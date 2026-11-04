const occurrenceBookService = require('../../services/occurrenceBookService');


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
