const caseService = require('../../services/caseService');
const partyService = require('../../services/partyService');
const { logAudit } = require('../../utils/audit');
const { normalizeQuery } = require('../../utils/query');


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


exports.pendingOnline = async (req, res, next) => {
    try {
        const complaints = await caseService.listPendingOnlineComplaints();
        res.json({ success: true, data: { complaints } });
    } catch (err) {
        next(err);
    }
};


exports.lookupOnline = async (req, res, next) => {
    try {
        const result = await caseService.lookupOnlineComplaint(req.query.ref);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        res.json({ success: true, data: result });
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

        const { caseId, obNumber, criminalNumber, suspectName, complainantName } = result;

        if (suspectName) {
            await logAudit(req, user.id, 'SUSPECT_LINKED', `Linked suspect "${suspectName}" to Case ID ${caseId} during intake.`);
        }

        await logAudit(req, user.id, 'CASE_REGISTERED', `Registered new Case ID ${caseId} as OB ${obNumber} / ${criminalNumber} for complainant ${complainantName}.`);

        const message = suspectName
            ? `Case registered successfully as ${obNumber} (${criminalNumber}). Suspect "${suspectName}" was added — you can now generate an invitation letter for him/her.`
            : `Case registered successfully as ${obNumber} (${criminalNumber}).`;

        return res.status(201).json({ success: true, message, data: { caseId, obNumber, criminalNumber } });
    } catch (err) {
        next(err);
    }
};


exports.search = async (req, res, next) => {
    try {
        const params = normalizeQuery(req.query);
        const query = (params.q || '').trim();
        const searchType = params.type || 'all';
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


exports.smsNotifications = async (req, res, next) => {
    try {
        const result = await caseService.listSmsNotifications(req.params.id, req.session.user);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};


exports.resendSmsNotification = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.resendSmsNotification(
            req.params.id,
            req.params.notificationId,
            user
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(
            req,
            user.id,
            'SMS_NOTIFICATION_RESENT',
            `Resent assignment SMS notification ${req.params.notificationId} for Case ID ${req.params.id}.`
        );

        res.json({ success: true, message: result.message, data: result.result });
    } catch (err) {
        next(err);
    }
};


exports.addNote = async (req, res, next) => {    try {
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


exports.completeInvestigation = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.completeInvestigation(
            req.params.id,
            user,
            req.body.status_request_notes
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, user.id, 'CASE_SUBMITTED_FOR_REVIEW', result.auditDetails);

        res.json({
            success: true,
            message: 'Investigation marked complete. The Branch In-charge will decide whether to close the case or forward it to the Prosecution Branch.'
        });
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


exports.addParty = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await partyService.addParty(req.params.id, user, req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        const party = result.party || {};
        if (party.party_type === 'Suspect') {
            await logAudit(req, user.id, 'SUSPECT_LINKED', `Added suspect "${party.full_name}" to Case ID ${req.params.id}.`);
        } else if (party.party_type === 'Witness') {
            await logAudit(req, user.id, 'WITNESS_ADDED', `Added Witness No. ${party.witness_number} "${party.full_name}" to Case ID ${req.params.id}.`);
        }

        res.status(201).json({ success: true, message: result.message, data: { party } });
    } catch (err) {
        next(err);
    }
};


exports.parties = async (req, res, next) => {
    try {
        const parties = await partyService.listParties(req.params.id);
        res.json({ success: true, data: { parties } });
    } catch (err) {
        next(err);
    }
};


exports.submitOnline = async (req, res, next) => {
    try {
        const result = await caseService.submitOnlineComplaint(req.body);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        const { caseId, suspectName, complainantName } = result;
        if (suspectName) {
            try {
                await logAudit(req, null, 'ONLINE_COMPLAINT_SUBMITTED', `Online complaint submitted for Case ID ${caseId} (complainant ${complainantName}), suspect ${suspectName} linked.`);
            } catch (_) {}
        } else {
            try {
                await logAudit(req, null, 'ONLINE_COMPLAINT_SUBMITTED', `Online complaint submitted for Case ID ${caseId} (complainant ${complainantName}).`);
            } catch (_) {}
        }

        const message = suspectName
            ? `Complaint submitted successfully. It is pending police approval. Suspect "${suspectName}" was added.`
            : 'Complaint submitted successfully. It is pending police approval.';

        return res.status(201).json({ success: true, message, data: { caseId } });
    } catch (err) {
        next(err);
    }
};


exports.approveOnline = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.approveOnlineComplaint(user, req.params.id);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        return res.json({ success: true, message: result.message || 'Online complaint approved and entered into the system.', data: result });
    } catch (err) {
        next(err);
    }
};


exports.rejectOnline = async (req, res, next) => {
    try {
        const user = req.session.user;
        const result = await caseService.rejectOnlineComplaint(user, req.params.id, req.body && req.body.reason);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        return res.json({ success: true, message: result.message || 'Online complaint rejected.', data: result });
    } catch (err) {
        next(err);
    }
};

