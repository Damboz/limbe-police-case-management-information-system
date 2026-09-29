const caseService = require('../../services/caseService');
const reportsService = require('../../services/reportsService');


exports.dashboard = async (req, res, next) => {
    try {
        const result = await caseService.getPersonalDashboard(req.session.user);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.myAnalytics = async (req, res, next) => {
    try {
        const result = await reportsService.getMyAnalytics(req.session.user);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};
