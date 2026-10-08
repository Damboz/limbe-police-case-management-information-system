const caseService = require('../../services/caseService');
const { logAudit } = require('../../utils/audit');


exports.list = async (req, res, next) => {
    try {
        const cases = await caseService.listCasesForUser(req.session.user);
        res.json({ success: true, data: { cases } });
    } catch (err) {
        next(err);
    }
};


exports.formOptions = async (req, res, next) => {
    try {
        const data = await caseService.getCaseFormOptions();
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};


exports.create = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.createCase(user.id, req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        const { caseId, obNumber, suspectName, complainantName } = result;

        if (suspectName) {
            await logAudit(req, user.id, 'SUSPECT_LINKED', `Linked suspect "${suspectName}" to Case OB ${obNumber} during intake.`);
        }

        await logAudit(req, user.id, 'CASE_REGISTERED', `Registered new Case OB ${obNumber} for complainant ${complainantName}.`);

        const message = suspectName
            ? `Case registered successfully with reference ${obNumber}. Suspect "${suspectName}" was added — you can now generate an invitation letter for him/her.`
            : `Case registered successfully with reference ${obNumber}.`;

        return res.status(201).json({ success: true, message, data: { caseId, obNumber } });
    } catch (err) {
        next(err);
    }
};


exports.search = async (req, res, next) => {
    try {
        const query = (req.query.q || '').trim();
        const searchType = req.query.type || 'all';
        const results = await caseService.searchCases(query, searchType);

        res.json({ success: true, data: { results, query, searchType } });
    } catch (err) {
        next(err);
    }
};


exports.detail = async (req, res, next) => {
    try {
        const result = await caseService.getCaseDetail(req.params.id, req.session.user);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.addNote = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.addCaseNote(req.params.id, user, req.body.note);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'CASE_NOTE_ADDED', `Added investigation note to Case ID ${req.params.id}.`);

        res.json({ success: true, message: 'Investigation note added.' });
    } catch (err) {
        next(err);
    }
};


exports.requestStatus = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.requestStatusChange(
            req.params.id,
            user,
            req.body.requested_status,
            req.body.status_request_notes
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'STATUS_CHANGE_REQUESTED', `Requested status change to "${result.requestedStatus}" for Case ID ${req.params.id}.`);

        res.json({ success: true, message: 'Status change request submitted for branch review and final approval.' });
    } catch (err) {
        next(err);
    }
};


exports.requestExternalReport = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.requestExternalReport(req.params.id, user, req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'EXTERNAL_REPORT_REQUESTED', `Requested ${result.reportType} for Case ID ${req.params.id}.`);

        res.status(201).json({ success: true, message: `${result.reportType} request recorded.` });
    } catch (err) {
        next(err);
    }
};


exports.addEvidence = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.logEvidence(req.params.id, user, req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'EVIDENCE_LOGGED', `Logged evidence item "${result.itemNumber}" for Case ID ${req.params.id}.`);

        res.status(201).json({ success: true, message: 'Evidence item logged successfully.' });
    } catch (err) {
        next(err);
    }
};


exports.linkSuspect = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.linkSuspect(req.params.id, user, req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'SUSPECT_LINKED', `Linked suspect "${result.suspectName}" to Case ID ${req.params.id}.`);

        res.status(201).json({ success: true, message: 'Suspect linked to case successfully.' });
    } catch (err) {
        next(err);
    }
};


exports.linkVictim = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.linkVictim(req.params.id, user, req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'VICTIM_LINKED', `Linked victim "${result.victimName}" to Case ID ${req.params.id}.`);

        res.status(201).json({ success: true, message: 'Victim information added to case.' });
    } catch (err) {
        next(err);
    }
};
