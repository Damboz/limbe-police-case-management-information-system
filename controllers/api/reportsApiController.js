const caseService = require('../../services/caseService');
const reportsService = require('../../services/reportsService');
const pdfService = require('../../services/pdfService');
const { logAudit, getClientIp } = require('../../utils/audit');


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


exports.suspectInvitation = async (req, res, next) => {
    try {
        const { id, suspectId } = req.params;
        const { appearance_date, appearance_time, officer_notes } = req.body;
        const user = req.session.user;

        const result = await reportsService.prepareSuspectInvitation(id, suspectId, user, appearance_date);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        const { caseItem, suspect } = result;
        const suspectFullName = `${suspect.first_name} ${suspect.last_name}`;

        const { buffer } = pdfService.buildSuspectInvitationPdf({
            caseItem,
            suspect,
            user,
            appearanceDate: appearance_date,
            appearanceTime: appearance_time,
            officerNotes: officer_notes
        });

        const pdfBuffer = await buffer;

        await logAudit(
            req,
            user.id,
            'INVITATION_LETTER_GENERATED',
            `Generated invitation letter for suspect "${suspectFullName}" (ID ${suspectId}) to appear on ${appearance_date} — Case ${caseItem.ob_number}.`
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Invitation_${caseItem.ob_number}_${suspectId}.pdf"`);
        return res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
};
