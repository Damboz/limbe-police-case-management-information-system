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

    const [noteText, setNoteText] = useState('');
    const [requestedStatus, setRequestedStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [evidenceForm, setEvidenceForm] = useState({ item_number: '', category: 'Physical', description: '', storage_location: '', collected_at: '' });
    const [suspectForm, setSuspectForm] = useState({ first_name: '', last_name: '', alias: '', gender: '', national_id: '', phone_number: '' });
    const [victimForm, setVictimForm] = useState({ full_name: '', phone_number: '', email: '', national_id: '', statement: '' });
    const [inviteTarget, setInviteTarget] = useState(null);
    const [inviteForm, setInviteForm] = useState({ appearance_date: '', appearance_time: '09:00', officer_notes: '' });

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

    const { caseItem, assignedInvestigatorNames, notes, evidenceItems, suspects, victims, permissions } = data;

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
                            <Label>Unit</Label>
                            <span className="fw-semibold">{caseItem.unit_name}</span>
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
                            <strong>{caseItem.status_requested_by_name}</strong> on {formatDateTime(caseItem.status_requested_at)}, and is
                            awaiting Supervisor review.
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
                                    <option value="Closed">Close Case</option>
                                    <option value="Court Pending">Transfer to Court</option>
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
