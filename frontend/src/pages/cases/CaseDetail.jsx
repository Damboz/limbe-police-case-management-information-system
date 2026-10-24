import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


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
    const party = useSubmitter();
    const letter = useSubmitter();
    const minute = useSubmitter();
    const report = useSubmitter();
    const tracking = useSubmitter();
    const evidenceCapture = useSubmitter();

    const [noteText, setNoteText] = useState('');
    const [requestedStatus, setRequestedStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [partyForm, setPartyForm] = useState({
        party_type: 'Witness',
        full_name: '',
        first_name: '',
        last_name: '',
        alias: '',
        gender: '',
        national_id: '',
        phone_number: '',
        email: '',
        age: '',
        occupation: '',
        ta: '',
        village: '',
        address: '',
        statement: ''
    });
    const [inviteTarget, setInviteTarget] = useState(null);
    const [inviteForm, setInviteForm] = useState({ appearance_date: '', appearance_time: '09:00', officer_notes: '' });
    const [minuteForm, setMinuteForm] = useState({ decision: 'Recommend', comment: '' });
    const [reportForm, setReportForm] = useState({ report_type: 'Social Welfare Report', notes: '' });
    const [ackForm, setAckForm] = useState({ file_location: '', notes: '' });
    const [fileLocValue, setFileLocValue] = useState('');
    const [courtForm, setCourtForm] = useState({ court_date: '', court_outcome: '' });
    const [queryText, setQueryText] = useState('');
    const [evidenceModal, setEvidenceModal] = useState({ open: false, partyId: null, partyName: '' });
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const [evidenceStatement, setEvidenceStatement] = useState('');

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

    const { caseItem, assignedInvestigatorNames, notes, parties = [], minutes, custodyLog, externalReports, permissions } = data;

    const setParty = (key) => (e) => setPartyForm(prev => ({ ...prev, [key]: e.target.value }));

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

    const submitParty = async (e) => {
        e.preventDefault();
        await party.run(async () => {
            const res = await api.addParty(id, partyForm);
            toast.success(res.message);
            if (partyForm.party_type === 'Witness') {
                setPartyForm({ party_type: 'Witness', full_name: '', first_name: '', last_name: '', alias: '', gender: '', national_id: '', phone_number: '', email: '', age: '', occupation: '', ta: '', village: '', address: '', statement: '' });
            } else if (partyForm.party_type === 'Suspect') {
                setPartyForm({ party_type: 'Suspect', full_name: '', first_name: '', last_name: '', alias: '', gender: '', national_id: '', phone_number: '', email: '', age: '', occupation: '', ta: '', village: '', address: '', statement: '' });
            } else {
                setPartyForm({ party_type: 'Witness', full_name: '', first_name: '', last_name: '', alias: '', gender: '', national_id: '', phone_number: '', email: '', age: '', occupation: '', ta: '', village: '', address: '', statement: '' });
            }
            reload();
        });
    };

    const openEvidenceModal = (party) => {
        setEvidenceModal({ open: true, partyId: party.id, partyName: party.full_name });
        setEvidenceFiles([]);
        setEvidenceStatement('');
    };

    const submitEvidenceCapture = async (e) => {
        e.preventDefault();
        await evidenceCapture.run(async () => {
            const formData = new FormData();
            for (let i = 0; i < evidenceFiles.length; i++) {
                formData.append('files', evidenceFiles[i]);
            }
            formData.append('statement', evidenceStatement);
            const res = await api.capturePartyEvidence(id, evidenceModal.partyId, formData);
            toast.success(res.message || 'Evidence captured.');
            setEvidenceModal({ open: false, partyId: null, partyName: '' });
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

    const minuteBadge = (type) => {
        if (type === 'BRANCH_REVIEW') return <span className="badge badge-case-open">Branch In-charge</span>;
        if (type === 'COMMANDER_APPROVAL') return <span className="badge badge-case-investigation">Station Officer</span>;
        if (type === 'PROSECUTOR_QUERY') return <span className="badge badge-case-forwarded">Prosecution</span>;
        return <span className="badge bg-light text-dark border">Internal</span>;
    };

    const overlay = (submitter) => submitter.error && (
        <Alert variant="danger" message={submitter.error} onDismiss={() => submitter.setError(null)} />
    );

    const complainants = parties.filter(p => p.party_type === 'Complainant');
    const witnesses = parties.filter(p => p.party_type === 'Witness');
    const suspectsList = parties.filter(p => p.party_type === 'Suspect');
    const canManageParties = permissions?.canManageParties || permissions?.canLinkSuspectVictim || permissions?.canAddNote;

    return (
        <>
            <PageHeader
                title={caseItem.ob_number ? `Case ${caseItem.ob_number}` : `Case #${caseItem.id} (Unnumbered)`}
                subtitle={`${caseItem.incident_location} • Registered ${formatDate(caseItem.created_at)}`}
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
                            <span className="small text-muted">
                                {caseItem.complainant_phone}
                                {caseItem.complainant_gender ? <> • {caseItem.complainant_gender}</> : null}
                                {caseItem.complainant_age ? <> • Age: {caseItem.complainant_age}</> : null}
                            </span>
                        </div>
                        <div className="col-md-3">
                            <Label>Case Numbers</Label>
                            <span className="fw-semibold d-block">
                                OB: {caseItem.ob_number || <span className="text-muted fst-italic fw-normal">Unnumbered</span>}
                            </span>
                            <span className="fw-semibold d-block">Criminal: {caseItem.criminal_number || '-'}</span>
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
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white py-3 d-flex align-items-center justify-content-between">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-people me-2 text-warning" />Parties</h6>
                    <div className="d-flex gap-2">
                        <Link to="/evidence" className="btn btn-outline-light btn-sm">Evidence Ledger</Link>
                    </div>
                </div>
                <div className="card-body">
                    {overlay(party)}

                    {canManageParties && (
                        <form onSubmit={submitParty} className="mb-4 border rounded p-3 bg-light">
                            <div className="row g-2 align-items-end">
                                <div className="col-md-3">
                                    <label className="form-label small">Party Type</label>
                                    <select className="form-select form-select-sm" value={partyForm.party_type} onChange={setParty('party_type')}>
                                        <option value="Witness">Witness</option>
                                        <option value="Suspect">Suspect</option>
                                    </select>
                                </div>
                                {partyForm.party_type === 'Witness' && (
                                    <>
                                        <div className="col-md-3">
                                            <label className="form-label small">Full Name *</label>
                                            <input type="text" className="form-control form-control-sm" value={partyForm.full_name} onChange={setParty('full_name')} required />
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label small">Phone</label>
                                            <input type="text" className="form-control form-control-sm" value={partyForm.phone_number} onChange={setParty('phone_number')} />
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label small">Gender</label>
                                            <select className="form-select form-select-sm" value={partyForm.gender} onChange={setParty('gender')}>
                                                <option value="">--</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label small">Statement</label>
                                            <input type="text" className="form-control form-control-sm" value={partyForm.statement} onChange={setParty('statement')} />
                                        </div>
                                    </>
                                )}
                                {partyForm.party_type === 'Suspect' && (
                                    <>
                                        <div className="col-md-2">
                                            <label className="form-label small">First Name *</label>
                                            <input type="text" className="form-control form-control-sm" value={partyForm.first_name} onChange={setParty('first_name')} required />
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label small">Last Name *</label>
                                            <input type="text" className="form-control form-control-sm" value={partyForm.last_name} onChange={setParty('last_name')} required />
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label small">Gender *</label>
                                            <select className="form-select form-select-sm" value={partyForm.gender} onChange={setParty('gender')} required>
                                                <option value="">--</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label small">Phone</label>
                                            <input type="text" className="form-control form-control-sm" value={partyForm.phone_number} onChange={setParty('phone_number')} />
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label small">Alias</label>
                                            <input type="text" className="form-control form-control-sm" value={partyForm.alias} onChange={setParty('alias')} />
                                        </div>
                                    </>
                                )}
                                <div className="col-md-1">
                                    <button type="submit" className="btn btn-navy btn-sm w-100" disabled={party.busy}>
                                        <i className="bi bi-plus-lg" />
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    <div className="mb-4">
                        <h6 className="fw-bold mb-2"><span className="badge bg-secondary me-2">Complainant</span></h6>
                        {complainants.length === 0 && <p className="text-muted small mb-0">None</p>}
                        {complainants.map(p => (
                            <div key={p.id} className="d-flex align-items-center justify-content-between border rounded p-2 mb-2 flex-wrap gap-2">
                                <div>
                                    <div className="fw-semibold">{p.full_name} {p.witness_number ? <span className="text-muted small">(Witness No. {p.witness_number})</span> : null}</div>
                                    <div className="small text-muted">{p.phone_number || ''} {p.gender ? ` • ${p.gender}` : ''}</div>
                                    {p.statement && <div className="small fst-italic text-muted">"{p.statement}"</div>}
                                </div>
                                <div className="d-flex gap-2">
                                    <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => openEvidenceModal(p)}>
                                        <i className="bi bi-file-earmark-plus me-1" />Add Evidence
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mb-4">
                        <h6 className="fw-bold mb-2"><span className="badge bg-info text-dark me-2">Witness</span></h6>
                        {witnesses.length === 0 && <p className="text-muted small mb-0">None</p>}
                        {witnesses.map(p => (
                            <div key={p.id} className="d-flex align-items-center justify-content-between border rounded p-2 mb-2 flex-wrap gap-2">
                                <div>
                                    <div className="fw-semibold">{p.full_name} <span className="text-muted small">(Witness No. {p.witness_number})</span></div>
                                    <div className="small text-muted">{p.phone_number || ''} {p.gender ? ` • ${p.gender}` : ''}</div>
                                    {p.statement && <div className="small fst-italic text-muted">"{p.statement}"</div>}
                                </div>
                                <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => openEvidenceModal(p)}>
                                    <i className="bi bi-file-earmark-plus me-1" />Add Evidence
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mb-2">
                        <h6 className="fw-bold mb-2"><span className="badge bg-danger me-2">Suspect</span></h6>
                        {suspectsList.length === 0 && <p className="text-muted small mb-0">None</p>}
                        {suspectsList.map(p => (
                            <div key={p.id} className="d-flex align-items-center justify-content-between border rounded p-2 mb-2 flex-wrap gap-2">
                                <div>
                                    <div className="fw-semibold">{p.full_name}</div>
                                    <div className="small text-muted">{p.phone_number || ''} {p.gender ? ` • ${p.gender}` : ''} {p.alias ? ` • Alias: ${p.alias}` : ''}</div>
                                </div>
                                <div className="d-flex gap-2 flex-wrap">
                                    {permissions?.canGenerateInvitationLetter && (
                                        <button type="button" className="btn btn-warning btn-sm fw-semibold" onClick={() => openInvitation(p)}>
                                            <i className="bi bi-envelope-paper me-1" />Invitation Letter
                                        </button>
                                    )}
                                    <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => openEvidenceModal(p)}>
                                        <i className="bi bi-file-earmark-plus me-1" />Add Evidence
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {evidenceModal.open && (
                <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header bg-navy text-white">
                                <h5 className="modal-title">Add Evidence - {evidenceModal.partyName}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setEvidenceModal({ open: false, partyId: null, partyName: '' })}></button>
                            </div>
                            <form onSubmit={submitEvidenceCapture}>
                                <div className="modal-body">
                                    {overlay(evidenceCapture)}
                                    <div className="mb-3">
                                        <label className="form-label">Statement (saved in statements and ledger as "Statement")</label>
                                        <textarea className="form-control" rows="3" value={evidenceStatement} onChange={(e) => setEvidenceStatement(e.target.value)}></textarea>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Upload files (documents, videos, audio, photos)</label>
                                        <input type="file" className="form-control" multiple onChange={(e) => setEvidenceFiles(Array.from(e.target.files || []))} />
                                        <div className="form-text">Max 25MB per file. Files will be renamed safely and hashed (SHA-256).</div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setEvidenceModal({ open: false, partyId: null, partyName: '' })}>Cancel</button>
                                    <button type="submit" className="btn btn-navy" disabled={evidenceCapture.busy}>{evidenceCapture.busy ? 'Saving...' : 'Save'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
