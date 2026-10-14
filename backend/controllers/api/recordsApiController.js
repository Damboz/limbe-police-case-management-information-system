const recordsService = require('../../services/recordsService');
const { logAudit } = require('../../utils/audit');


exports.dashboard = async (req, res, next) => {
    try {
        const result = await recordsService.getRecordsDashboard(req.session.user);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.assignNumbers = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await recordsService.assignCaseNumbers(user, req.params.id, req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'NUMBERS_ASSIGNED', result.auditDetails);

        res.json({
            success: true,
            message: result.message,
            data: {
                caseId: result.caseId,
                obNumber: result.obNumber,
                criminalNumber: result.criminalNumber
            }
        });
    } catch (err) {
        next(err);
    }
};
