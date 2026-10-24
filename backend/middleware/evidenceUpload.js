const multer = require('multer');
const path = require('path');
const fs = require('fs');

const EVIDENCE_ROOT = path.join(__dirname, '..', 'evidence_storage');

function ensureCaseDir(caseId) {
    const safeCaseId = String(caseId).replace(/[^0-9]/g, '');
    if (!safeCaseId) throw new Error('Invalid case id');
    const caseDir = path.join(EVIDENCE_ROOT, safeCaseId);
    if (!caseDir.startsWith(EVIDENCE_ROOT)) {
        throw new Error('Path traversal detected');
    }
    fs.mkdirSync(caseDir, { recursive: true });
    return caseDir;
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            const caseDir = ensureCaseDir(req.params.id);
            cb(null, caseDir);
        } catch (err) {
            cb(err);
        }
    },
    filename: function (req, file, cb) {
        // Will be renamed after validation; use temp name now
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB
    }
});

module.exports = {
    upload,
    ensureCaseDir,
    EVIDENCE_ROOT
};
