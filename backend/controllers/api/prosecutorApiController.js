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


exports.forwardToCourt = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await prosecutorService.forwardToCourt(
            user,
            req.params.id,
            {
                courtDate: req.body.court_date,
                courtOfficerId: req.body.court_officer_id,
                notes: req.body.notes
            }
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'CASE_FORWARDED_TO_COURT', result.auditDetails);

        res.json({ success: true, message: result.message });
    } catch (err) {
        next(err);
    }
};
