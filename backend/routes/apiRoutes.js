const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const caseApi = require('../controllers/api/caseApiController');
const adminApi = require('../controllers/api/adminApiController');
const supervisorApi = require('../controllers/api/supervisorApiController');
const branchApi = require('../controllers/api/branchApiController');
const prosecutorApi = require('../controllers/api/prosecutorApiController');
const recordsApi = require('../controllers/api/recordsApiController');
const reportsApi = require('../controllers/api/reportsApiController');
const generalApi = require('../controllers/api/generalApiController');

const { isAuthenticated, isAdmin, denyAdmin, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../roles');
const { upload } = require('../middleware/evidenceUpload');
const { validateEvidenceFile } = require('../utils/evidenceSecurity');
const db = require('../config/db');
const { isAssignedInvestigator } = require('../services/assignmentService');
const { logAudit } = require('../utils/audit');


router.post('/auth/login', require('../controllers/api/authApiController').login);
router.post('/auth/logout', require('../controllers/api/authApiController').logout);
router.post('/auth/forgot-password', require('../controllers/api/authApiController').forgotPassword);
router.post('/auth/reset-password', require('../controllers/api/authApiController').resetPassword);
router.get('/auth/me', isAuthenticated, require('../controllers/api/authApiController').me);
router.post('/auth/change-password', isAuthenticated, require('../controllers/api/authApiController').changePassword);


router.get('/dashboard', isAuthenticated, generalApi.dashboard);
router.get('/my-analytics', isAuthenticated, authorizeRoles(ROLES.POLICE_OFFICER), reportsApi.myAnalytics);


router.get('/cases', isAuthenticated, denyAdmin, caseApi.list);
router.get('/cases/new', isAuthenticated, denyAdmin, caseApi.formOptions);
router.post('/cases', isAuthenticated, denyAdmin, caseApi.create);
router.get('/cases/search', isAuthenticated, denyAdmin, caseApi.search);
router.get('/cases/:id', isAuthenticated, denyAdmin, caseApi.detail);
router.get('/cases/:id/parties', isAuthenticated, denyAdmin, caseApi.parties);
router.post('/cases/:id/notes', isAuthenticated, denyAdmin, caseApi.addNote);
router.post('/cases/:id/request-status', isAuthenticated, denyAdmin, caseApi.requestStatus);
router.post('/cases/:id/external-reports', isAuthenticated, denyAdmin, caseApi.requestExternalReport);
router.post('/cases/:id/parties', isAuthenticated, denyAdmin, caseApi.addParty);
router.post('/cases/:id/suspects', isAuthenticated, denyAdmin, caseApi.addParty);
router.post('/cases/:id/victims', isAuthenticated, denyAdmin, caseApi.addParty);
router.post(
    '/cases/:id/suspects/:suspectId/letter',
    isAuthenticated,
    denyAdmin,
    reportsApi.suspectInvitation
);


// Evidence Ledger (new)
router.get('/evidence', isAuthenticated, authorizeRoles(ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER), async (req, res, next) => {
    try {
        const user = req.session.user;
        const pool = await db.ready();
        const { partyId, type, q } = req.query;

        let where = '1=1';
        const params = [];
        let idx = 1;

        // scope
        if (user.role !== ROLES.STATION_OFFICER && user.role !== ROLES.ADMIN) {
            where += ` AND c.id IN (SELECT ci.case_id FROM case_investigators ci WHERE ci.investigator_id = $${idx})`;
            params.push(user.id);
            idx++;
        }

        if (partyId) {
            where += ` AND el.party_id = $${idx}`;
            params.push(partyId);
            idx++;
        }
        if (type) {
            where += ` AND el.evidence_type = $${idx}`;
            params.push(type);
            idx++;
        }
        if (q) {
            where += ` AND (el.ledger_no ILIKE $${idx} OR el.description ILIKE $${idx} OR el.file_name ILIKE $${idx})`;
            params.push(`%${q}%`);
            idx++;
        }

        const [rows] = await pool.query(
            `SELECT el.id, el.ledger_no, el.evidence_type, el.status, el.collected_at, el.sha256, el.file_name,
                    c.id as case_id, c.ob_number,
                    cp.full_name as party_name, cp.party_type,
                    CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) as collected_by_name
             FROM evidence_ledger el
             LEFT JOIN cases c ON c.id = el.case_id
             LEFT JOIN case_parties cp ON cp.id = el.party_id
             LEFT JOIN users u ON u.id = el.collected_by_officer_id
             WHERE ${where}
             ORDER BY el.collected_at DESC
             LIMIT 500`,
            params
        );

        res.json({ success: true, data: { evidenceItems: rows } });
    } catch (err) {
        next(err);
    }
});

router.get('/evidence/:id', isAuthenticated, async (req, res, next) => {
    try {
        const user = req.session.user;
        const pool = await db.ready();
        const [rows] = await pool.query(
            `SELECT el.*, c.id as case_id, c.ob_number,
                    cp.full_name as party_name, cp.party_type,
                    CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) as collected_by_name
             FROM evidence_ledger el
             LEFT JOIN cases c ON c.id = el.case_id
             LEFT JOIN case_parties cp ON cp.id = el.party_id
             LEFT JOIN users u ON u.id = el.collected_by_officer_id
             WHERE el.id = $1`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
        const ev = rows[0];

        const isAssigned = await isAssignedInvestigator(ev.case_id, user.id);
        const allowed = isAssigned || [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER, ROLES.ADMIN, ROLES.PROSECUTOR, ROLES.RECORDS_OFFICER, ROLES.BRANCH_OFFICER].includes(user.role);
        if (!allowed) return res.status(403).json({ success: false, error: 'Not authorized' });

        const [custody] = await pool.query(
            `SELECT ec.*, CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) as recorded_by_name
             FROM evidence_custody_events ec
             LEFT JOIN users u ON u.id = ec.recorded_by
             WHERE ec.ledger_id = $1
             ORDER BY ec.event_at ASC, ec.id ASC`,
            [req.params.id]
        );
        const [transfers] = await pool.query(
            `SELECT et.*, 
                    CONCAT(fu.rank_title, ' ', fu.first_name, ' ', fu.last_name) as from_user_name,
                    CONCAT(tu.rank_title, ' ', tu.first_name, ' ', tu.last_name) as to_user_name,
                    CONCAT(au.rank_title, ' ', au.first_name, ' ', au.last_name) as approved_by_name
             FROM evidence_transfers et
             LEFT JOIN users fu ON fu.id = et.from_user_id
             LEFT JOIN users tu ON tu.id = et.to_user_id
             LEFT JOIN users au ON au.id = et.approved_by
             WHERE et.ledger_id = $1
             ORDER BY et.requested_at DESC`,
            [req.params.id]
        );

        res.json({ success: true, data: { evidence: ev, custody, transfers } });
    } catch (err) {
        next(err);
    }
});

router.post('/evidence/:id/transfer/request', isAuthenticated, async (req, res, next) => {
    try {
        const user = req.session.user;
        const pool = await db.ready();
        const [rows] = await pool.query('SELECT el.*, c.id as case_id FROM evidence_ledger el JOIN cases c ON c.id = el.case_id WHERE el.id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
        const ev = rows[0];
        const isAssigned = await isAssignedInvestigator(ev.case_id, user.id);
        if (!isAssigned && user.role !== ROLES.POLICE_OFFICER) return res.status(403).json({ success: false, error: 'Only Investigating Officer can request transfer' });

        const { to_user_id, location, reason } = req.body;
        if (!to_user_id || !reason) return res.status(400).json({ success: false, error: 'to_user_id and reason required' });

        const [resIns] = await pool.query(
            `INSERT INTO evidence_transfers (ledger_id, case_id, from_user_id, to_user_id, location, reason, status)
             VALUES ($1,$2,$3,$4,$5,$6,'Requested') RETURNING id`,
            [req.params.id, ev.case_id, user.id, to_user_id, location || null, reason]
        );
        try { await logAudit(req, user.id, 'EVIDENCE_TRANSFER_REQUESTED', `Requested transfer of evidence ledger ${req.params.id}`); } catch (_) { }
        res.status(201).json({ success: true, message: 'Transfer requested', data: { id: resIns.rows[0].id } });
    } catch (err) {
        next(err);
    }
});

router.post('/evidence/transfer/:transferId/approve', isAuthenticated, async (req, res, next) => {
    try {
        const user = req.session.user;
        if (user.role !== ROLES.STATION_OFFICER && user.role !== ROLES.ADMIN) {
            return res.status(403).json({ success: false, error: 'Only Station Commander can approve transfers' });
        }
        const pool = await db.ready();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const [tRows] = await client.query('SELECT * FROM evidence_transfers WHERE id = $1 FOR UPDATE', [req.params.transferId]);
            if (tRows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Not found' }); }
            const t = tRows[0];
            if (t.status !== 'Requested') { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'Transfer not in requested state' }); }

            await client.query("UPDATE evidence_transfers SET status='Approved', approved_by=$1, approved_at=NOW() WHERE id=$2", [user.id, req.params.transferId]);

            await client.query(
                `INSERT INTO evidence_custody_events (ledger_id, event_type, from_custodian_id, to_custodian_id, location, notes, recorded_by, event_at)
                 VALUES ($1,'Transferred',$2,$3,$4,$5,$6,NOW())`,
                [t.ledger_id, t.from_user_id, t.to_user_id, t.location || null, t.reason || 'Transfer approved', user.id]
            );
            await client.query('UPDATE evidence_ledger SET current_custodian_id=$1, status=$2, updated_at=NOW() WHERE id=$3', [t.to_user_id, 'Transferred to Lab', t.ledger_id]);

            await client.query('COMMIT');
            try { await logAudit(req, user.id, 'EVIDENCE_TRANSFER_APPROVED', `Approved transfer ${req.params.transferId}`); } catch (_) { }
            res.json({ success: true, message: 'Transfer approved' });
        } catch (e) {
            try { await client.query('ROLLBACK'); } catch (_) { }
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        next(err);
    }
});

router.post('/evidence/:id/note', isAuthenticated, async (req, res, next) => {
    try {
        const user = req.session.user;
        const pool = await db.ready();
        const [rows] = await pool.query('SELECT el.*, c.id as case_id FROM evidence_ledger el JOIN cases c ON c.id = el.case_id WHERE el.id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
        const ev = rows[0];
        const isAssigned = await isAssignedInvestigator(ev.case_id, user.id);
        const allowed = isAssigned || [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER, ROLES.ADMIN].includes(user.role);
        if (!allowed) return res.status(403).json({ success: false, error: 'Not authorized' });

        const note = req.body.note || req.body.correction || '';
        if (!note.trim()) return res.status(400).json({ success: false, error: 'Note required' });

        await pool.query(
            `INSERT INTO evidence_custody_events (ledger_id, event_type, location, notes, recorded_by, event_at)
             VALUES ($1,'Transferred',$2,$3,$4,NOW())`,
            [req.params.id, null, note.trim(), user.id]
        );
        try { await logAudit(req, user.id, 'EVIDENCE_NOTE_ADDED', `Added note to evidence ledger ${req.params.id}`); } catch (_) { }
        res.json({ success: true, message: 'Note added' });
    } catch (err) {
        next(err);
    }
});

router.post('/evidence/:id/verify', isAuthenticated, async (req, res, next) => {
    try {
        const user = req.session.user;
        const pool = await db.ready();
        const [rows] = await pool.query('SELECT el.*, c.id as case_id FROM evidence_ledger el JOIN cases c ON c.id = el.case_id WHERE el.id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
        const ev = rows[0];

        const isAssigned = await isAssignedInvestigator(ev.case_id, user.id);
        const allowed = isAssigned || [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER, ROLES.ADMIN, ROLES.PROSECUTOR].includes(user.role);
        if (!allowed) return res.status(403).json({ success: false, error: 'Not authorized' });

        if (!ev.file_path) {
            return res.json({ success: true, data: { match: false, message: 'No file to verify' } });
        }
        const baseDir = path.join(__dirname, '..');
        const resolved = path.resolve(baseDir, ev.file_path);
        if (!resolved.startsWith(path.resolve(baseDir, 'evidence_storage'))) {
            return res.status(403).json({ success: false, error: 'Invalid path' });
        }
        if (!fs.existsSync(resolved)) {
            return res.json({ success: true, data: { match: false, message: 'File missing' } });
        }
        const buf = fs.readFileSync(resolved);
        const computed = crypto.createHash('sha256').update(buf).digest('hex');
        const match = ev.sha256 && computed === ev.sha256;
        res.json({ success: true, data: { match, computed, stored: ev.sha256 } });
    } catch (err) {
        next(err);
    }
});


router.post(
    '/cases/:id/parties/:partyId/evidence',
    isAuthenticated,
    denyAdmin,
    (req, res, next) => {
        upload.array('files', 10)(req, res, function (err) {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ success: false, error: 'File too large. Max 25MB per file.' });
                }
                return res.status(400).json({ success: false, error: err.message || 'Upload error' });
            }
            next();
        });
    },
    async (req, res, next) => {
        try {
            const user = req.session.user;
            const caseId = req.params.id;
            const partyId = req.params.partyId;
            const files = req.files || [];
            const statement = req.body.statement || req.body.statement_text || '';

            const pool = await db.ready();

            const [caseRows] = await pool.query('SELECT id FROM cases WHERE id = $1', [caseId]);
            if (caseRows.length === 0) {
                return res.status(404).json({ success: false, error: 'Case not found.' });
            }

            const [partyRows] = await pool.query('SELECT id, case_id, party_type FROM case_parties WHERE id = $1 AND case_id = $2', [partyId, caseId]);
            if (partyRows.length === 0) {
                return res.status(404).json({ success: false, error: 'Party not found.' });
            }

            const isAssigned = await isAssignedInvestigator(caseId, user.id);
            const allowed = isAssigned || [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER, ROLES.ADMIN].includes(user.role);
            if (!allowed) {
                return res.status(403).json({ success: false, error: 'Not authorized to capture evidence for this case.' });
            }

            for (const f of files) {
                const v = validateEvidenceFile(f);
                if (!v.ok) {
                    return res.status(400).json({ success: false, error: v.error });
                }
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                let statementId = null;
                if (statement && statement.trim()) {
                    const stmtRes = await client.query(
                        `INSERT INTO case_statements (case_id, party_id, statement_text, source, recorded_by)
                         VALUES ($1, $2, $3, 'INTAKE', $4)
                         RETURNING id`,
                        [caseId, partyId, statement.trim(), user.id]
                    );
                    statementId = stmtRes.rows[0].id;

                    const ledgerNoResStmt = await client.query("SELECT next_evidence_ledger_no() AS ledger_no");
                    const ledgerNoStmt = ledgerNoResStmt.rows[0].ledger_no;
                    const evStmtRes = await client.query(
                        `INSERT INTO evidence_ledger (
                             ledger_no, case_id, party_id, evidence_type, description,
                             collected_by_officer_id, collected_at, current_custodian_id, status, created_by
                         ) VALUES ($1, $2, $3, 'Other', $4, $5, NOW(), $6, 'In Locker', $7)
                         RETURNING id`,
                        [ledgerNoStmt, caseId, partyId, 'Statement', user.id, user.id, user.id]
                    );
                    const ledgerStmtId = evStmtRes.rows[0].id;
                    await client.query(
                        `INSERT INTO evidence_custody_events (ledger_id, event_type, to_custodian_id, location, notes, recorded_by, event_at)
                         VALUES ($1, 'Collected', $2, $3, $4, $5, NOW())`,
                        [ledgerStmtId, user.id, 'Statement', 'Collected', user.id]
                    );
                }

                const createdEvidence = [];

                for (const f of files) {
                    const ledgerNoRes = await client.query("SELECT next_evidence_ledger_no() AS ledger_no");
                    const ledger_no = ledgerNoRes.rows[0].ledger_no;

                    const fileBuffer = fs.readFileSync(f.path);
                    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

                    const ext = path.extname(f.originalname || '').toLowerCase();
                    let evidence_type = 'Documentary';
                    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff'].includes(ext)) {
                        evidence_type = 'Digital';
                    } else if (['.mp4', '.webm', '.mov', '.mkv'].includes(ext)) {
                        evidence_type = 'Digital';
                    } else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) {
                        evidence_type = 'Digital';
                    } else if (ext === '.pdf') {
                        evidence_type = 'Documentary';
                    }

                    const safeName = crypto.randomBytes(16).toString('hex') + ext;
                    const finalPath = path.join(path.dirname(f.path), safeName);
                    fs.renameSync(f.path, finalPath);

                    const relPath = path.relative(path.join(__dirname, '..'), finalPath).replace(/\\/g, '/');

                    const evRes = await client.query(
                        `INSERT INTO evidence_ledger (
                             ledger_no, case_id, party_id, evidence_type, description,
                             file_name, file_path, mime_type, file_size, sha256,
                             collected_by_officer_id, collected_at, current_custodian_id, status, created_by
                         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, 'In Locker', $13)
                         RETURNING id`,
                        [
                            ledger_no,
                            caseId,
                            partyId,
                            evidence_type,
                            f.originalname,
                            f.originalname,
                            relPath,
                            f.mimetype,
                            f.size,
                            hash,
                            user.id,
                            user.id,
                            user.id
                        ]
                    );

                    const ledgerId = evRes.rows[0].id;

                    await client.query(
                        `INSERT INTO evidence_custody_events (ledger_id, event_type, to_custodian_id, location, notes, recorded_by, event_at)
                         VALUES ($1, 'Collected', $2, $3, $4, $5, NOW())`,
                        [ledgerId, user.id, 'Per case folder', 'Collected', user.id]
                    );

                    createdEvidence.push({ id: ledgerId, ledger_no, file_name: f.originalname });
                }

                await client.query('COMMIT');
                try {
                    await logAudit(req, user.id, 'EVIDENCE_CAPTURED', `Captured evidence for Case ID ${caseId} (party ${partyId}): ${createdEvidence.length} file(s); statement: ${statementId ? 'yes' : 'no'}.`);
                } catch (_) { }
                res.status(201).json({
                    success: true,
                    message: 'Evidence captured successfully.',
                    data: { statementId, evidence: createdEvidence }
                });
            } catch (e) {
                try { await client.query('ROLLBACK'); } catch (_) { }
                for (const f of files) {
                    try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (_) { }
                }
                throw e;
            } finally {
                client.release();
            }
        } catch (err) {
            next(err);
        }
    }
);


router.get('/evidence/:ledgerId/file', isAuthenticated, async (req, res, next) => {
    try {
        const user = req.session.user;
        const ledgerId = req.params.ledgerId;
        const pool = await db.ready();

        const [rows] = await pool.query(
            `SELECT el.*, c.id as case_id
             FROM evidence_ledger el
             JOIN cases c ON c.id = el.case_id
             WHERE el.id = $1`,
            [ledgerId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Evidence not found.' });
        }
        const ev = rows[0];

        const isAssigned = await isAssignedInvestigator(ev.case_id, user.id);
        const allowed = isAssigned || [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER, ROLES.ADMIN, ROLES.PROSECUTOR, ROLES.RECORDS_OFFICER, ROLES.BRANCH_OFFICER].includes(user.role);
        if (!allowed) {
            return res.status(403).json({ success: false, error: 'Not authorized to access this evidence.' });
        }

        if (!ev.file_path) {
            return res.status(404).json({ success: false, error: 'File not available.' });
        }

        const baseDir = path.join(__dirname, '..');
        const resolved = path.resolve(baseDir, ev.file_path);
        if (!resolved.startsWith(path.resolve(baseDir, 'evidence_storage'))) {
            return res.status(403).json({ success: false, error: 'Invalid file path.' });
        }
        if (!fs.existsSync(resolved)) {
            return res.status(404).json({ success: false, error: 'File missing.' });
        }

        res.setHeader('Content-Type', ev.mime_type || 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', `inline; filename="${String(ev.file_name || 'evidence').replace(/"/g, '')}"`);
        const stream = fs.createReadStream(resolved);
        stream.pipe(res);
    } catch (err) {
        next(err);
    }
});


router.get('/admin/dashboard', isAuthenticated, isAdmin, adminApi.dashboard);
router.get('/admin/users', isAuthenticated, isAdmin, adminApi.users);
router.get('/admin/users/form-options', isAuthenticated, isAdmin, adminApi.formOptions);
router.post('/admin/users', isAuthenticated, isAdmin, adminApi.createUser);
router.get('/admin/users/:id', isAuthenticated, isAdmin, adminApi.editUser);
router.put('/admin/users/:id', isAuthenticated, isAdmin, adminApi.updateUser);
router.post('/admin/users/:id/toggle-status', isAuthenticated, isAdmin, adminApi.toggleStatus);
router.delete('/admin/users/:id', isAuthenticated, isAdmin, adminApi.deleteUser);
router.get('/admin/audit-logs', isAuthenticated, isAdmin, adminApi.auditLogs);
router.delete('/admin/audit-logs', isAuthenticated, isAdmin, adminApi.clearAuditLogs);


router.get('/supervisor/dashboard', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.dashboard);
router.post('/supervisor/cases/:id/classify', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.classifyCase);
router.post('/supervisor/cases/assign', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.assignCase);
router.post('/supervisor/cases/approve-status', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.approveStatus);
router.post('/supervisor/cases/:id/resolve-query', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.resolveQuery);
router.post('/supervisor/reassign-proposals/:id/decide', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.decideReassignment);
router.get('/supervisor/analytics', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.analytics);
router.get('/supervisor/analytics/hotspots', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.hotspots);
router.get('/supervisor/analytics/categories', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.categories);


router.get('/branch/dashboard', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.dashboard);
router.post('/branch/cases/assign', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.assignCase);
router.post('/branch/cases/:id/review', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.reviewCase);
router.post('/branch/cases/:id/reassign-proposal', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.proposeReassignment);
router.post('/branch/cases/:id/external-reports', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.requestExternalReport);
router.post('/branch/external-reports/:reportId/received', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.markReportReceived);


router.get('/records/dashboard', isAuthenticated, authorizeRoles(ROLES.RECORDS_OFFICER), recordsApi.dashboard);
router.post('/records/cases/:id/numbers', isAuthenticated, authorizeRoles(ROLES.RECORDS_OFFICER), recordsApi.assignNumbers);


router.get('/prosecution/dashboard', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.dashboard);
router.post('/prosecution/cases/:id/acknowledge', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.acknowledge);
router.post('/prosecution/cases/:id/file-location', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.fileLocation);
router.post('/prosecution/cases/:id/court', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.court);
router.post('/prosecution/cases/:id/query', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.query);


module.exports = router;
