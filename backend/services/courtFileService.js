const path = require('path');
const fs = require('fs');

const db = require('../config/db');
const { ok, fail } = require('../utils/result');
const { ROLES, roleIn, ASSIGNMENT_ROLE_TYPES, ASSIGNMENT_STATUSES } = require('../roles');
const { listParties } = require('./partyService');
const { getAssignedInvestigators } = require('./assignmentService');
const { buildCourtCaseFilePdf } = require('./pdfService');
const { createZip } = require('../utils/zip');
const { EVIDENCE_ROOT } = require('../middleware/evidenceUpload');

const BACKEND_ROOT = path.join(__dirname, '..');
const STORAGE_ROOT = path.resolve(EVIDENCE_ROOT);


function safeName(value, fallback = 'file') {
    return String(value || fallback)
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 150) || fallback;
}


function fileStamp() {
    return new Date().toISOString().slice(0, 10);
}


// The officer standing with the case in court is recorded twice in the system:
// cases.court_officer_id (set by the prosecutor when forwarding to court) and an
// active case_assignments row of type "Court Standing Officer" (set when the
// station/branch officer assigns the team). Either one grants access. Prosecutors
// and administrators keep oversight access.
async function canDownloadCourtFile(caseItem, user) {
    if (Number(caseItem.court_officer_id) === Number(user.id)) return true;
    if (roleIn(user, [ROLES.PROSECUTOR, ROLES.ADMIN])) return true;

    const [rows] = await db.execute(
        `SELECT 1 FROM case_assignments
         WHERE case_id = ? AND assigned_to = ?
           AND role_type = ? AND status = ?
         LIMIT 1`,
        [caseItem.id, user.id, ASSIGNMENT_ROLE_TYPES.COURT_STANDING_OFFICER, ASSIGNMENT_STATUSES.ACTIVE]
    );
    return rows.length > 0;
}


async function loadCourtCaseData(caseId, user) {
    const [caseRows] = await db.execute(
        `SELECT
             c.*,
             cc.name AS crime_category,
             sb.name AS branch_name,
             CONCAT(rec.rank_title, ' ', rec.first_name, ' ', rec.last_name) AS recorded_by_name,
             CONCAT(co.rank_title, ' ', co.first_name, ' ', co.last_name) AS court_officer_name,
             co.badge_number AS court_officer_badge
         FROM cases c
         LEFT JOIN crime_categories cc ON c.category_id = cc.id
         LEFT JOIN station_branch sb ON c.branch_id = sb.id
         LEFT JOIN users rec ON c.recorded_by = rec.id
         LEFT JOIN users co ON c.court_officer_id = co.id
         WHERE c.id = ?`,
        [caseId]
    );

    if (caseRows.length === 0) {
        return fail(404, 'Case record not found.');
    }

    const caseItem = caseRows[0];
    if (!await canDownloadCourtFile(caseItem, user)) {
        return fail(403, 'Only the officer assigned to stand with this case in court can download its case file.');
    }

    const [
        parties,
        investigators,
        [evidenceLedger],
        [evidenceLegacy],
        [minutes],
        [notes]
    ] = await Promise.all([
        listParties(caseId),
        getAssignedInvestigators(caseId),

        db.execute(
            `SELECT el.*,
                    CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS collected_by_name,
                    p.full_name AS party_name
             FROM evidence_ledger el
             LEFT JOIN users u ON el.collected_by_officer_id = u.id
             LEFT JOIN case_parties p ON el.party_id = p.id
             WHERE el.case_id = ?
             ORDER BY el.ledger_no ASC, el.id ASC`,
            [caseId]
        ),

        db.execute(
            `SELECT e.*,
                    CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS collected_by_name
             FROM evidence e
             LEFT JOIN users u ON e.collected_by_officer_id = u.id
             WHERE e.case_id = ?
             ORDER BY e.collected_at ASC`,
            [caseId]
        ),

        db.execute(
            `SELECT m.*,
                    CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS author_name
             FROM case_minutes m
             LEFT JOIN users u ON m.author_id = u.id
             WHERE m.case_id = ?
             ORDER BY m.created_at ASC`,
            [caseId]
        ),

        db.execute(
            `SELECT n.*,
                    CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS officer_name
             FROM case_notes n
             LEFT JOIN users u ON n.officer_id = u.id
             WHERE n.case_id = ?
             ORDER BY n.created_at ASC`,
            [caseId]
        )
    ]);

    return ok({
        caseItem,
        parties,
        investigators,
        evidenceLedger,
        evidenceLegacy,
        minutes,
        notes
    });
}


function collectEvidenceFiles(evidenceLedger) {
    const entries = [];
    const usedNames = new Set();

    for (const item of evidenceLedger) {
        if (!item.file_path) continue;

        const resolved = path.resolve(BACKEND_ROOT, item.file_path);
        if (!resolved.startsWith(`${STORAGE_ROOT}${path.sep}`)) continue;
        if (!fs.existsSync(resolved)) continue;

        const original = safeName(item.file_name || path.basename(resolved), `evidence_${item.id}`);
        const prefix = safeName(item.ledger_no || `EV-${item.id}`, `EV-${item.id}`);
        let entryName = `Evidence/${prefix}_${original}`;
        let suffix = 1;
        while (usedNames.has(entryName)) {
            const ext = path.extname(original);
            const base = path.basename(original, ext);
            entryName = `Evidence/${prefix}_${base}_${suffix}${ext}`;
            suffix++;
        }
        usedNames.add(entryName);

        entries.push({ name: entryName, data: fs.readFileSync(resolved) });
    }

    return entries;
}


async function getCourtFile(user, caseId, format) {
    const loaded = await loadCourtCaseData(caseId, user);
    if (!loaded.ok) return loaded;

    const { caseItem, parties, investigators, evidenceLedger, evidenceLegacy, minutes, notes } = loaded;
    const reference = safeName(caseItem.ob_number || `Case_${caseItem.id}`, `Case_${caseItem.id}`);
    const generatedBy = [user.rank_title, user.first_name, user.last_name]
        .filter(Boolean).join(' ') + (user.badge_number ? ` (${user.badge_number})` : '');

    const { buffer: pdfBuffer } = buildCourtCaseFilePdf({
        caseItem,
        parties,
        investigators,
        evidenceLedger,
        evidenceLegacy,
        minutes,
        notes,
        generatedBy
    });

    const pdf = await pdfBuffer;

    if (format === 'zip') {
        const entries = [
            { name: `Court_Case_File_${reference}.pdf`, data: pdf },
            ...collectEvidenceFiles(evidenceLedger)
        ];
        return ok({
            buffer: createZip(entries),
            fileName: `Court_Case_File_${reference}_${fileStamp()}.zip`,
            contentType: 'application/zip'
        });
    }

    return ok({
        buffer: pdf,
        fileName: `Court_Case_File_${reference}_${fileStamp()}.pdf`,
        contentType: 'application/pdf'
    });
}


module.exports = { getCourtFile, canDownloadCourtFile };
