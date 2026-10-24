const crypto = require('crypto');
const path = require('path');

function sha256File(buffer) {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
}

function safeRandomName(ext) {
    return crypto.randomBytes(16).toString('hex') + ext;
}

function getAllowedEvidenceExtensions() {
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.mp4', '.webm', '.mov', '.mkv', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.zip'];
}

function getAllowedMimeTypes() {
    return [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-matroska',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/mp4',
        'audio/aac',
        'application/zip'
    ];
}

function validateEvidenceFile(file) {
    if (!file) return { ok: false, error: 'No file provided.' };
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExt = getAllowedEvidenceExtensions();
    const allowedMime = getAllowedMimeTypes();
    if (!allowedExt.includes(ext)) {
        return { ok: false, error: 'File type not allowed by extension.' };
    }
    if (!allowedMime.includes(file.mimetype)) {
        return { ok: false, error: 'File type not allowed by MIME.' };
    }
    return { ok: true };
}

module.exports = {
    sha256File,
    safeRandomName,
    getAllowedEvidenceExtensions,
    getAllowedMimeTypes,
    validateEvidenceFile
};
