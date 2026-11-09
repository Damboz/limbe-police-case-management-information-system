const courtFileService = require('../../services/courtFileService');
const { logAudit } = require('../../utils/audit');


function sendDownload(res, result) {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.end(result.buffer);
}


async function handleDownload(req, res, next, format) {
    try {
        const user = req.session.user;
        const result = await courtFileService.getCourtFile(user, req.params.id, format);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(
            req,
            user.id,
            'COURT_FILE_DOWNLOADED',
            `Downloaded court case file (${format.toUpperCase()}) for Case ID ${req.params.id}.`
        );

        sendDownload(res, result);
    } catch (err) {
        next(err);
    }
}


exports.downloadPdf = (req, res, next) => handleDownload(req, res, next, 'pdf');
exports.downloadZip = (req, res, next) => handleDownload(req, res, next, 'zip');
