import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


const EVIDENCE_CATEGORIES = ['Physical', 'Documentary', 'Digital', 'Forensic', 'Weapon', 'Other'];

// A suspect must be given at least three days to prepare before being summoned.
const APPEARANCE_NOTICE_DAYS = 3;


function earliestAppearanceDate() {
    const min = new Date();
    min.setDate(min.getDate() + APPEARANCE_NOTICE_DAYS);
    return min.toISOString().slice(0, 10);
}


function Label({ children }) {
    return <span className="text-muted small text-uppercase fw-semibold d-block">{children}</span>;
}


function useSubmitter() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const run = async (fn) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return { busy, error, setError, run };
}


export default function CaseDetail() {
    const { id } = useParams();
    const toast = useToast();
    const { data, error, loading, reload } = useApiData((signal) => api.caseDetail(id, signal), [id]);
    usePageTitle(data?.caseItem?.ob_number ? `Case ${data.caseItem.ob_number}` : 'Case Detail');

    const note = useSubmitter();
    const statusReq = useSubmitter();
    const evidence = useSubmitter();
    const suspect = useSubmitter();
    const victim = useSubmitter();
    const letter = useSubmitter();
    const minute = useSubmitter();
    const report = useSubmitter();
    const tracking = useSubmitter();

    const [noteText, setNoteText] = useState('');
    const [requestedStatus, setRequestedStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [evidenceForm, setEvidenceForm] = useState({ item_number: '', category: 'Physical', description: '', storage_location: '', collected_at: '' });
    const [suspectForm, setSuspectForm] = useState({ first_name: '', last_name: '', alias: '', gender: '', national_id: '', phone_number: '' });
    const [victimForm, setVictimForm] = useState({ full_name: '', phone_number: '', email: '', national_id: '', statement: '' });
    const [inviteTarget, setInviteTarget] = useState(null);
    const [inviteForm, setInviteForm] = useState({ appearance_date: '', appearance_time: '09:00', officer_notes: '' });
    const [minuteForm, setMinuteForm] = useState({ decision: 'Recommend', comment: '' });
    const [reportForm, setReportForm] = useState({ report_type: 'Social Welfare Report', notes: '' });
    const [ackForm, setAckForm] = useState({ file_location: '', notes: '' });
    const [fileLocValue, setFileLocValue] = useState('');
    const [courtForm, setCourtForm] = useState({ court_date: '', court_outcome: '' });
    const [queryText, setQueryText] = useState('');

    if (loading) return <Spinner />;

    if (error) {
        return (
            <>
                <PageHeader
                    title="Case Detail"
                    subtitle="The requested case could not be loaded."
                    actions={
                        <Link to="/cases" className="btn btn-outline-navy btn-sm">
                            <i className="bi bi-arrow-left me-1" />Back to Case Register
                        </Link>
                    }
                />
                <Alert variant="danger" message={error} />
            </>
        );
    }

    const { caseItem, assignedInvestigatorNames, notes, evidenceItems, suspects, victims, minutes, custodyLog, externalReports, permissions } = data;

    const setEvidence = (key) => (e) => setEvidenceForm(prev => ({ ...prev, [key]: e.target.value }));
    const setSuspect = (key) => (e) => setSuspectForm(prev => ({ ...prev, [key]: e.target.value }));
    const setVictim = (key) => (e) => setVictimForm(prev => ({ ...prev, [key]: e.target.value }));

    const submitNote = async (e) => {
        e.preventDefault();
        await note.run(async () => {
            const res = await api.addCaseNote(id, noteText);
            toast.success(res.message);
            setNoteText('');
            reload();
        });
    };

    const submitStatus = async (e) => {
        e.preventDefault();
        await statusReq.run(async () => {
            const res = await api.requestCaseStatus(id, { requested_status: requestedStatus, status_request_notes: statusNotes });
            toast.success(res.message);
            setRequestedStatus('');
            setStatusNotes('');
            reload();
        });
    };

    const submitEvidence = async (e) => {
        e.preventDefault();
        await evidence.run(async () => {
            const res = await api.addCaseEvidence(id, evidenceForm);
            toast.success(res.message);
            setEvidenceForm({ item_number: '', category: 'Physical', description: '', storage_location: '', collected_at: '' });
            reload();
        });
    };

    const submitSuspect = async (e) => {
        e.preventDefault();
        await suspect.run(async () => {
            const res = await api.linkSuspect(id, suspectForm);
            toast.success(res.message);
            setSuspectForm({ first_name: '', last_name: '', alias: '', gender: '', national_id: '', phone_number: '' });
            reload();
        });
    };

    const submitVictim = async (e) => {
        e.preventDefault();
        await victim.run(async () => {
            const res = await api.linkVictim(id, victimForm);
            toast.success(res.message);
            setVictimForm({ full_name: '', phone_number: '', email: '', national_id: '', statement: '' });
            reload();
        });
    };

    const openInvitation = (s) => {
        setInviteTarget(s);
        setInviteForm({
            appearance_date: earliestAppearanceDate(),
            appearance_time: '09:00',
            officer_notes: ''
        });
    };

    const submitInvitation = async (e) => {
        e.preventDefault();
        await letter.run(async () => {
            const res = await api.suspectInvitation(id, inviteTarget.id, inviteForm);
            toast.success(res.fileName ? `Invitation letter downloaded (${res.fileName}).` : 'Invitation letter downloaded.');
            setInviteTarget(null);
        });
    };

    const submitMinute = async (e) => {
        e.preventDefault();
        await minute.run(async () => {
            const res = await api.reviewCase(id, minuteForm);
            toast.success(res.message);
            setMinuteForm({ decision: 'Recommend', comment: '' });
            reload();
        });
    };

    const submitReport = async (e) => {
        e.preventDefault();
        await report.run(async () => {
            const res = await api.requestCaseExternalReport(id, reportForm);
            toast.success(res.message);
            setReportForm({ report_type: 'Social Welfare Report', notes: '' });
            reload();
        });
    };

    const submitAcknowledge = async (e) => {
        e.preventDefault();
        await tracking.run(async () => {
            const res = await api.acknowledgeReceipt(id, ackForm);
            toast.success(res.message);
            setAckForm({ file_location: '', notes: '' });
            reload();
        });
    };

    const submitFileLocation = async (e) => {
        e.preventDefault();
        await tracking.run(async () => {
            const res = await api.updateFileLocation(id, { file_location: fileLocValue });
            toast.success(res.message);
            setFileLocValue('');
            reload();
        });
    };

    const submitCourt = async (e) => {
        e.preventDefault();
        await tracking.run(async () => {
            const res = await api.recordCourtDetails(id, courtForm);
            toast.success(res.message);
            setCourtForm({ court_date: '', court_outcome: '' });
            reload();
        });
    };

    const submitQuery = async (e) => {
        e.preventDefault();
        await tracking.run(async () => {
            const res = await api.sendQuery(id, { query: queryText });
            toast.success(res.message);
            setQueryText('');
            reload();
        });
    };

    const minuteBadge = (type) => {
        if (type === 'BRANCH_REVIEW') return <span className="badge badge-case-open">Branch In-charge</span>;
        if (type === 'COMMANDER_APPROVAL') return <span className="badge badge-case-investigation">Station Officer</span>;
        if (type === 'PROSECUTOR_QUERY') return <span className="badge badge-case-forwarded">Prosecution</span>;
        return <span className="badge bg-light text-dark border">Internal</span>;
    };

    const overlay = (submitter) => submitter.error && (
        <Alert variant="danger" message={submitter.error} onDismiss={() => submitter.setError(null)} />
    );

    return (
        <>
            <PageHeader
                title={`Case ${caseItem.ob_number}`}
                subtitle={`${caseItem.incident_location} · Registered ${formatDate(caseItem.created_at)}`}
                actions={
                    <Link to="/cases" className="btn btn-outline-navy btn-sm">
                        <i className="bi bi-arrow-left me-1" />Back to Case Register
                    </Link>
                }
            />

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3 flex-wrap gap-2">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-info-circle-fill me-2 text-warning" />Case Overview</h6>
                    <div className="d-flex gap-2">
                        <PriorityBadge priority={caseItem.priority} />
                        <StatusBadge status={caseItem.status} fallback="Under Investigation" />
                    </div>
                </div>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-3">
                            <Label>Complainant</Label>
                            <span className="fw-semibold">{caseItem.complainant_name}</span><br />
                            <span className="small text-muted">{caseItem.complainant_phone}</span>
                        </div>
                        <div className="col-md-3">
                            <Label>Category</Label>
                            <span className="fw-semibold">{caseItem.crime_category}</span>
                        </div>
                        <div className="col-md-3">
                            <Label>Branch</Label>
                            <span className="fw-semibold">{caseItem.branch_name}</span>
                        </div>
                        <div className="col-md-3">
                            <Label>Assigned Investigator(s)</Label>
                            {assignedInvestigatorNames.length === 0 ? (
                                <span className="fw-semibold">Unassigned</span>
                            ) : (
                                assignedInvestigatorNames.map((name, idx) => (
                                    <span key={name} className="fw-semibold d-block">
                                        {name}
                                        {idx === 0 && <span className="badge bg-light text-dark border ms-1">Lead</span>}
                                    </span>
                                ))
                            )}
                        </div>
                        <div className="col-md-3">
                            <Label>Intake Officer</Label>
                            <span className="fw-semibold">{caseItem.intake_officer_name}</span>
                        </div>
                        <div className="col-md-3">
                            <Label>Incident Date/Time</Label>
                            <span className="fw-semibold">
                                {caseItem.incident_datetime ? formatDateTime(caseItem.incident_datetime) : 'Not specified'}
                            </span>
                        </div>
                        <div className="col-md-6">
                            <Label>Incident Narrative</Label>
                            <span>{caseItem.incident_details}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-hourglass-split me-2 text-warning" />Status Request</h6>
                </div>
                <div className="card-body">
                    {overlay(statusReq)}

                    {caseItem.requested_status ? (
                        <div className="alert alert-warning small mb-0">
                            <i className="bi bi-clock-history me-2" />
                            A request to change status to <strong>{caseItem.requested_status}</strong> was submitted by{' '}
                            <strong>{caseItem.status_requested_by_name}</strong> on {formatDateTime(caseItem.status_requested_at)}.
                            {caseItem.branch_review_status === 'Pending Review' && (
                                <> It is awaiting <strong>Branch In-charge</strong> review.</>
                            )}
                            {caseItem.branch_review_status === 'Recommended' && (
                                <> It has been <strong>recommended</strong> by the Branch In-charge and is awaiting final approval.</>
                            )}
                            {caseItem.branch_review_status === 'Returned' && (
                                <> The Branch In-charge has <strong>returned</strong> this request for further investigation.</>
                            )}
                            {caseItem.status_request_notes && (
                                <><br /><span className="text-muted">Notes: {caseItem.status_request_notes}</span></>
                            )}
                        </div>
                    ) : permissions.canRequestStatus ? (
                        <form onSubmit={submitStatus} className="row g-3 align-items-end">
                            <div className="col-md-4">
                                <label htmlFor="requested_status" className="form-label">Request Status Change <span className="text-danger">*</span></label>
                                <select id="requested_status" className="form-select" value={requestedStatus} onChange={e => setRequestedStatus(e.target.value)} required>
                                    <option value="">-- Select --</option>
                                    <option value="Forwarded to Prosecution">Forward to Prosecution Branch</option>
                                    <option value="Court Pending">Transfer to Court</option>
                                    <option value="Closed">Close Case</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="status_request_notes" className="form-label">Justification</label>
                                <input
                                    type="text"
                                    id="status_request_notes"
                                    className="form-control"
                                    placeholder="Brief reason for this request"
                                    value={statusNotes}
                                    onChange={e => setStatusNotes(e.target.value)}
                                />
                            </div>
                            <div className="col-md-2">
                                <button type="submit" className="btn btn-navy w-100" disabled={statusReq.busy}>
                                    {statusReq.busy ? 'Submitting…' : <><i className="bi bi-send-fill me-1" />Submit</>}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <p className="text-muted small mb-0">No status change request is currently pending for this case.</p>
                    )}
                </div>
            </div>

            {permissions.canReview && caseItem.branch_review_status === 'Pending Review' && (
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-gold text-dark py-3">
                        <h6 className="mb-0 fw-bold">
                            <i className="bi bi-clipboard-check me-2" />Branch In-charge Review Required
                        </h6>
                    </div>
                    <div className="card-body">
                        {overlay(minute)}
                        <p className="text-muted small mb-3">
                            Review this completion request before it is forwarded to the Station Officer. Your minute is
                            recorded permanently.
                        </p>
                        <form onSubmit={submitMinute} className="row g-3 align-items-end">
                            <div className="col-md-3">
                                <label htmlFor="minute_decision" className="form-label">Decision <span className="text-danger">*</span></label>
                                <select id="minute_decision" className="form-select" value={minuteForm.decision} onChange={e => setMinuteForm(prev => ({ ...prev, decision: e.target.value }))} required>
                                    <option value="Recommend">Recommend to Station Officer</option>
                                    <option value="Return">Return for Further Investigation</option>
                                </select>
                            </div>
                            <div className="col-md-7">
                                <label htmlFor="minute_comment" className="form-label">Branch Minute / Comment <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    id="minute_comment"
                                    className="form-control"
                                    placeholder="Record your substantive recommendation as the Branch In-charge..."
                                    value={minuteForm.comment}
                                    onChange={e => setMinuteForm(prev => ({ ...prev, comment: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="col-md-2">
                                <button type="submit" className="btn btn-navy w-100" disabled={minute.busy}>
                                    {minute.busy ? 'Submitting…' : <><i className="bi bi-check-lg me-1" />Submit Minute</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="row g-4 mb-4">
                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-signpost-split me-2 text-warning" />Sign-off Chain &amp; Minutes</h6>
                        </div>
                        <div className="card-body">
                            {(minutes || []).length === 0 ? (
                                <p className="text-muted small mb-0">No managerial minutes recorded yet.</p>
                            ) : (
                                <div className="timeline">
                                    {minutes.map(m => (
                                        <div className="timeline-item" key={m.id}>
                                            <div className="d-flex flex-wrap align-items-center gap-2">
                                                <span className="small fw-semibold text-muted">{formatDateTime(m.created_at)}</span>
                                                {minuteBadge(m.minute_type)}
                                                <span className={`badge ${m.decision === 'Returned' || m.decision === 'Rejected' ? 'badge-priority-critical' : 'badge-case-closed'}`}>{m.decision}</span>
                                            </div>
                                            <div className="small text-muted mt-1">{m.author_name}</div>
                                            <div className="small mt-1 mb-0">{m.comment}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-archive me-2 text-warning" />File Tracking &amp; External Reports</h6>
                        </div>
                        <div className="card-body">
                            {overlay(tracking)}
                            {overlay(report)}

                            {(custodyLog || []).length > 0 && (
                                <div className="mb-3">
                                    <Label>Custody Handover Trail</Label>
                                    {custodyLog.map(item => (
                                        <div className="small text-muted d-block" key={item.id}>
                                            <i className="bi bi-arrow-left-right me-1" />
                                            {item.handed_over_by_name} → {item.received_by_name || 'Prosecution desk'} · {formatDate(item.handed_over_at)}
                                            {item.status === 'Acknowledged' && item.received_at && <> · received {formatDate(item.received_at)}</>}
                                            {item.status === 'Acknowledged' && item.file_location && <div className="ps-4">File: {item.file_location}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {permissions.canAcknowledgeReceipt && (
                                <form onSubmit={submitAcknowledge} className="border rounded p-3 bg-light mb-3">
                                    <Label>Acknowledge File Receipt</Label>
                                    <div className="row g-2 mt-1">
                                        <div className="col-7">
                                            <input type="text" className="form-control form-control-sm" placeholder="Physical location (e.g. shelf B3)" value={ackForm.file_location} onChange={e => setAckForm(prev => ({ ...prev, file_location: e.target.value }))} />
                                        </div>
                                        <div className="col-5">
                                            <button type="submit" className="btn btn-navy btn-sm w-100" disabled={tracking.busy}>
                                                <i className="bi bi-box-arrow-in-down me-1" />Confirm Receipt
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {permissions.canUpdateFileLocation && (
                                <form onSubmit={submitFileLocation} className="border rounded p-3 bg-light mb-3">
                                    <Label>Update Physical File Location</Label>
                                    <div className="row g-2 mt-1">
                                        <div className="col-7">
                                            <input type="text" className="form-control form-control-sm" placeholder="e.g. Archives cabinet 2, shelf C" value={fileLocValue} onChange={e => setFileLocValue(e.target.value)} required />
                                        </div>
                                        <div className="col-5">
                                            <button type="submit" className="btn btn-navy btn-sm w-100" disabled={tracking.busy}>
                                                <i className="bi bi-archive me-1" />Save Location
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {permissions.canRecordCourt && (
                                <form onSubmit={submitCourt} className="border rounded p-3 bg-light mb-3">
                                    <Label>Record Court Details</Label>
                                    <div className="row g-2 mt-1">
                                        <div className="col-6">
                                            <input type="date" className="form-control form-control-sm" value={courtForm.court_date} onChange={e => setCourtForm(prev => ({ ...prev, court_date: e.target.value }))} />
                                        </div>
                                        <div className="col-6">
                                            <select className="form-select form-select-sm" value={courtForm.court_outcome} onChange={e => setCourtForm(prev => ({ ...prev, court_outcome: e.target.value }))}>
                                                <option value="">Outcome</option>
                                                <option value="Convicted">Convicted</option>
                                                <option value="Acquitted">Acquitted</option>
                                                <option value="Withdrawn">Withdrawn</option>
                                                <option value="Adjourned">Adjourned</option>
                                            </select>
                                        </div>
                                        <div className="col-12">
                                            <button type="submit" className="btn btn-navy btn-sm w-100" disabled={tracking.busy}>
                                                <i className="bi bi-bank2 me-1" />Save Court Details
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {permissions.canSendQuery && (
                                <form onSubmit={submitQuery} className="border rounded p-3 bg-light mb-3">
                                    <Label>Query the Station Officer</Label>
                                    <textarea rows="2" className="form-control form-control-sm mt-1" placeholder="What does the Prosecution Branch need answered?" value={queryText} onChange={e => setQueryText(e.target.value)} required />
                                    <button type="submit" className="btn btn-navy btn-sm w-100 mt-2" disabled={tracking.busy || !!caseItem.prosecution_query}>
                                        <i className="bi bi-chat-square-text me-1" />Send Query
                                    </button>
                                </form>
                            )}

                            {(externalReports || []).length > 0 && (
                                <div className="mb-3">
                                    <Label>External Report Requests</Label>
                                    {externalReports.map(item => (
                                        <div className="small d-block" key={item.id}>
                                            <span className="fw-semibold">{item.report_type}</span>{' '}
                                            <span className={`badge ${item.status === 'Received' ? 'badge-case-closed' : 'badge-priority-critical'}`}>{item.status}</span>
                                            <span className="text-muted"> · requested {formatDate(item.requested_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {permissions.canRequestExternalReport && (
                                <form onSubmit={submitReport} className="border rounded p-3 bg-light mb-3">
                                    <Label>Request External Report</Label>
                                    <div className="row g-2 mt-1">
                                        <div className="col-6">
                                            <select className="form-select form-select-sm" value={reportForm.report_type} onChange={e => setReportForm(prev => ({ ...prev, report_type: e.target.value }))}>
                                                <option value="Social Welfare Report">Social Welfare Report</option>
                                                <option value="Medical Report">Medical Report</option>
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <button type="submit" className="btn btn-navy btn-sm w-100" disabled={report.busy}>
                                                <i className="bi bi-send-fill me-1" />Request Report
                                            </button>
                                        </div>
                                        <div className="col-12">
                                            <input type="text" className="form-control form-control-sm" placeholder="Notes to the requesting office (optional)" value={reportForm.notes} onChange={e => setReportForm(prev => ({ ...prev, notes: e.target.value }))} />
                                        </div>
                                    </div>
                                </form>
                            )}

                            <div className="small text-muted">
                                {caseItem.file_location && <><i className="bi bi-geo-alt me-1" />File: {caseItem.file_location}<br /></>}
                                {caseItem.court_date && <><i className="bi bi-calendar-event me-1" />Court: {formatDate(caseItem.court_date)}</>}
                                {caseItem.court_outcome && <><span className="ms-2 badge badge-case-closed">{caseItem.court_outcome}</span></>}
                                {caseItem.prosecution_query && !caseItem.prosecution_query_resolved_at && (
                                    <div className="mt-2 alert alert-info small py-2 mb-0">
                                        <i className="bi bi-chat-square-text me-1" />Open query to Station Officer: &ldquo;{caseItem.prosecution_query}&rdquo;
                                    </div>
                                )}
                                {caseItem.prosecution_query && caseItem.prosecution_query_resolved_at && (
                                    <div className="mt-2 text-success small">
                                        <i className="bi bi-check-circle me-1" />Query resolved by the Station Officer; file remains with the Prosecution Branch.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4 mb-4">
                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-journal-text me-2 text-warning" />Investigation Notes &amp; Timeline</h6>
                        </div>
                        <div className="card-body">
                            {overlay(note)}
                            {permissions.canAddNote && (
                                <form onSubmit={submitNote} className="mb-3">
                                    <textarea
                                        rows="3"
                                        className="form-control mb-2"
                                        placeholder="Add a progress note, witness statement, or milestone event..."
                                        value={noteText}
                                        onChange={e => setNoteText(e.target.value)}
                                        required
                                    />
                                    <button type="submit" className="btn btn-navy btn-sm" disabled={note.busy}>
                                        <i className="bi bi-plus-lg me-1" />Add Note
                                    </button>
                                </form>
                            )}
                            {permissions.canAddNote && <hr />}

                            {notes.length === 0 ? (
                                <p className="text-muted small mb-0">No investigation notes recorded yet.</p>
                            ) : (
                                <div className="timeline">
                                    {notes.map(n => (
                                        <div className="timeline-item" key={n.id}>
                                            <div className="timeline-date">{formatDateTime(n.created_at)} · {n.officer_name}</div>
                                            <div className="small mt-1">{n.note}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-box-seam me-2 text-warning" />Evidence Ledger</h6>
                        </div>
                        <div className="card-body">
                            {overlay(evidence)}
                            {permissions.canAddEvidence && (
                                <form onSubmit={submitEvidence} className="mb-3">
                                    <div className="row g-2">
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="Item # *" value={evidenceForm.item_number} onChange={setEvidence('item_number')} required />
                                        </div>
                                        <div className="col-6">
                                            <select className="form-select form-select-sm" value={evidenceForm.category} onChange={setEvidence('category')}>
                                                {EVIDENCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-12">
                                            <input type="text" className="form-control form-control-sm" placeholder="Description *" value={evidenceForm.description} onChange={setEvidence('description')} required />
                                        </div>
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="Storage location *" value={evidenceForm.storage_location} onChange={setEvidence('storage_location')} required />
                                        </div>
                                        <div className="col-6">
                                            <input type="datetime-local" className="form-control form-control-sm" value={evidenceForm.collected_at} onChange={setEvidence('collected_at')} required />
                                        </div>
                                        <div className="col-12">
                                            <button type="submit" className="btn btn-navy btn-sm w-100" disabled={evidence.busy}>
                                                <i className="bi bi-plus-lg me-1" />Log Evidence
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}
                            {permissions.canAddEvidence && <hr />}

                            {evidenceItems.length === 0 ? (
                                <p className="text-muted small mb-0">No evidence items logged yet.</p>
                            ) : (
                                evidenceItems.map(item => (
                                    <div className="evidence-card p-2 mb-2" key={item.id}>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <span className="fw-bold small font-monospace">{item.item_number}</span>
                                                <span className="badge bg-light text-dark border ms-1">{item.category}</span>
                                            </div>
                                            <span className="badge bg-light text-dark border">{item.status}</span>
                                        </div>
                                        <div className="small mt-1">{item.description}</div>
                                        <div className="small text-muted mt-1">
                                            <i className="bi bi-geo-alt me-1" />{item.storage_location} ·
                                            Collected by {item.collected_by_name} on {formatDate(item.collected_at)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4 mb-4">
                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-person-bounding-box me-2 text-warning" />Suspects</h6>
                        </div>
                        <div className="card-body">
                            {overlay(suspect)}
                            {permissions.canLinkSuspectVictim && (
                                <form onSubmit={submitSuspect} className="mb-3">
                                    <div className="row g-2">
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="First name *" value={suspectForm.first_name} onChange={setSuspect('first_name')} required />
                                        </div>
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="Last name *" value={suspectForm.last_name} onChange={setSuspect('last_name')} required />
                                        </div>
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="Alias" value={suspectForm.alias} onChange={setSuspect('alias')} />
                                        </div>
                                        <div className="col-6">
                                            <select className="form-select form-select-sm" value={suspectForm.gender} onChange={setSuspect('gender')} required>
                                                <option value="">Gender *</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="National ID" value={suspectForm.national_id} onChange={setSuspect('national_id')} />
                                        </div>
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="Phone number" value={suspectForm.phone_number} onChange={setSuspect('phone_number')} />
                                        </div>
                                        <div className="col-12">
                                            <button type="submit" className="btn btn-navy btn-sm w-100" disabled={suspect.busy}>
                                                <i className="bi bi-plus-lg me-1" />Link Suspect
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}
                            {permissions.canLinkSuspectVictim && <hr />}

                            {suspects.length === 0 ? (
                                <p className="text-muted small mb-0">No suspects linked to this case yet.</p>
                            ) : (
                                suspects.map(s => (
                                    <div className="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom" key={s.id}>
                                        <div
                                            className="rounded-circle bg-light border d-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{ width: 36, height: 36 }}
                                        >
                                            <i className="bi bi-person-fill text-muted" />
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className="small fw-semibold">
                                                {s.first_name} {s.last_name}
                                                {s.alias && <span className="text-muted">&ldquo;{s.alias}&rdquo;</span>}
                                            </div>
                                            <div className="small text-muted">
                                                {s.link_status}{s.national_id && <> · National ID: {s.national_id}</>}
                                            </div>
                                        </div>
                                        <button type="button" className="btn btn-warning btn-sm fw-semibold" onClick={() => openInvitation(s)}>
                                            <i className="bi bi-envelope-paper me-1" />Invitation Letter
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-shield-fill-exclamation me-2 text-warning" />Victims</h6>
                        </div>
                        <div className="card-body">
                            {overlay(victim)}
                            {permissions.canLinkSuspectVictim && (
                                <form onSubmit={submitVictim} className="mb-3">
                                    <div className="row g-2">
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="Full name *" value={victimForm.full_name} onChange={setVictim('full_name')} required />
                                        </div>
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="Phone number" value={victimForm.phone_number} onChange={setVictim('phone_number')} />
                                        </div>
                                        <div className="col-6">
                                            <input type="email" className="form-control form-control-sm" placeholder="Email" value={victimForm.email} onChange={setVictim('email')} />
                                        </div>
                                        <div className="col-6">
                                            <input type="text" className="form-control form-control-sm" placeholder="National ID" value={victimForm.national_id} onChange={setVictim('national_id')} />
                                        </div>
                                        <div className="col-12">
                                            <textarea rows="2" className="form-control form-control-sm" placeholder="Victim statement (optional)" value={victimForm.statement} onChange={setVictim('statement')} />
                                        </div>
                                        <div className="col-12">
                                            <button type="submit" className="btn btn-navy btn-sm w-100" disabled={victim.busy}>
                                                <i className="bi bi-plus-lg me-1" />Add Victim
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}
                            {permissions.canLinkSuspectVictim && <hr />}

                            {victims.length === 0 ? (
                                <p className="text-muted small mb-0">No victim records linked to this case yet.</p>
                            ) : (
                                victims.map(v => (
                                    <div className="mb-2 pb-2 border-bottom" key={v.id}>
                                        <div className="small fw-semibold">{v.full_name}</div>
                                        <div className="small text-muted">{v.phone_number || 'No phone on file'}</div>
                                        {v.statement && <div className="small mt-1 fst-italic">&ldquo;{v.statement}&rdquo;</div>}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {inviteTarget && (
                <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ background: 'rgba(15,23,42,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <form onSubmit={submitInvitation}>
                                <div className="modal-header bg-warning text-dark">
                                    <h5 className="modal-title fw-bold">
                                        <i className="bi bi-envelope-paper me-2" />Generate Suspect Invitation Letter
                                    </h5>
                                    <button type="button" className="btn-close" aria-label="Close" onClick={() => setInviteTarget(null)} />
                                </div>
                                <div className="modal-body">
                                    <p className="mb-3 text-muted small">
                                        Issue a formal invitation letter requiring the suspect to report to Limbe Police Station.
                                        The letter will include the case details (OB reference, offence, and incident narrative).
                                    </p>
                                    {overlay(letter)}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Suspect</label>
                                        <input type="text" className="form-control" value={`${inviteTarget.first_name} ${inviteTarget.last_name}`} readOnly disabled />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="invAppearanceDate" className="form-label fw-semibold">
                                            Date of Appearance <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            id="invAppearanceDate"
                                            className="form-control"
                                            min={earliestAppearanceDate()}
                                            value={inviteForm.appearance_date}
                                            onChange={e => setInviteForm(prev => ({ ...prev, appearance_date: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="invAppearanceTime" className="form-label fw-semibold">Time of Appearance</label>
                                        <input
                                            type="time"
                                            id="invAppearanceTime"
                                            className="form-control"
                                            value={inviteForm.appearance_time}
                                            onChange={e => setInviteForm(prev => ({ ...prev, appearance_time: e.target.value }))}
                                        />
                                        <div className="form-text">Leave as 09:00 if no specific time agreed.</div>
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="invNotes" className="form-label fw-semibold">Officer Remarks / Items to Bring (Optional)</label>
                                        <textarea
                                            id="invNotes"
                                            rows="3"
                                            className="form-control"
                                            placeholder="e.g. Please bring your National ID and any documents related to the matter."
                                            value={inviteForm.officer_notes}
                                            onChange={e => setInviteForm(prev => ({ ...prev, officer_notes: e.target.value }))}
                                        />
                                    </div>
                                    <div className="alert alert-secondary small py-2 mb-0">
                                        <i className="bi bi-info-circle me-1" />
                                        The letter is saved to the audit log and a copy is returned as a PDF.
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setInviteTarget(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-warning btn-sm fw-bold" disabled={letter.busy}>
                                        {letter.busy ? 'Generating…' : <><i className="bi bi-download me-1" />Generate PDF</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
