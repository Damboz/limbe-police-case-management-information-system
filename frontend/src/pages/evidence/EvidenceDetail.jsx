import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


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


export default function EvidenceDetail() {
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    const toast = useToast();
    usePageTitle('Evidence Detail');
    const transfer = useSubmitter();
    const note = useSubmitter();
    const verify = useSubmitter();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [transferForm, setTransferForm] = useState({ to_user_id: '', location: '', reason: '' });
    const [noteText, setNoteText] = useState('');
    const [verifyResult, setVerifyResult] = useState(null);
    const [users, setUsers] = useState([]);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.evidenceDetail(id);
            setData(res.data || res);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // load users for transfer
        api.listUsers ? api.listUsers({}, null).then(r => {
            const list = r.data?.users || r.users || [];
            setUsers(list);
        }).catch(() => {}) : null;
    }, [id]);

    const submitTransferRequest = async (e) => {
        e.preventDefault();
        await transfer.run(async () => {
            const res = await api.requestEvidenceTransfer(id, transferForm);
            toast.success(res.message || 'Transfer requested.');
            setTransferForm({ to_user_id: '', location: '', reason: '' });
            load();
        });
    };

    const approveTransfer = async (transferId) => {
        await transfer.run(async () => {
            const res = await api.approveEvidenceTransfer(transferId, {});
            toast.success(res.message || 'Transfer approved.');
            load();
        });
    };

    const submitNote = async (e) => {
        e.preventDefault();
        await note.run(async () => {
            const res = await api.addEvidenceNote(id, { note: noteText });
            toast.success(res.message || 'Note added.');
            setNoteText('');
            load();
        });
    };

    const doVerify = async () => {
        await verify.run(async () => {
            const res = await api.verifyEvidenceIntegrity(id);
            setVerifyResult(res.data || res);
            toast.success(res.message || 'Verification complete.');
        });
    };

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const ev = data?.evidence || data;
    const custody = data?.custody || [];
    const transfers = data?.transfers || [];

    const fileUrl = ev?.id ? `/api/evidence/${ev.id}/file` : null;

    return (
        <>
            <PageHeader
                title={`Evidence ${ev?.ledger_no || ''}`}
                subtitle="Evidence detail and chain of custody"
                actions={
                    <Link to="/evidence" className="btn btn-outline-navy btn-sm">
                        <i className="bi bi-arrow-left me-1" />Back to Ledger
                    </Link>
                }
            />

            <div className="row g-4 mb-4">
                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-file-earmark me-2 text-warning" />File Preview</h6>
                        </div>
                        <div className="card-body">
                            {ev?.file_path ? (
                                <>
                                    {ev.mime_type && ev.mime_type.startsWith('image/') && (
                                        <img src={fileUrl} alt={ev.file_name} style={{ maxWidth: '100%', maxHeight: 400 }} className="img-fluid border" />
                                    )}
                                    {ev.mime_type && ev.mime_type.startsWith('video/') && (
                                        <video src={fileUrl} controls style={{ maxWidth: '100%', maxHeight: 400 }} />
                                    )}
                                    {ev.mime_type && ev.mime_type.startsWith('audio/') && (
                                        <audio src={fileUrl} controls style={{ width: '100%' }} />
                                    )}
                                    {ev.mime_type === 'application/pdf' && (
                                        <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-navy">Open PDF</a>
                                    )}
                                    {!((ev.mime_type && ev.mime_type.startsWith('image/')) || (ev.mime_type && ev.mime_type.startsWith('video/')) || (ev.mime_type && ev.mime_type.startsWith('audio/')) || ev.mime_type === 'application/pdf') && (
                                        <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-navy">Download/View File</a>
                                    )}
                                </>
                            ) : (
                                <p className="text-muted small">No file attached.</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-info-circle me-2 text-warning" />Metadata</h6>
                        </div>
                        <div className="card-body">
                            <div className="row g-2">
                                <div className="col-6"><Label>Ledger No</Label><div className="fw-semibold">{ev?.ledger_no}</div></div>
                                <div className="col-6"><Label>Type</Label><div>{ev?.evidence_type}</div></div>
                                <div className="col-6"><Label>Case ID</Label><div>{ev?.case_id}</div></div>
                                <div className="col-6"><Label>Party</Label><div>{ev?.party_name} {ev?.party_type ? `(${ev.party_type})` : ''}</div></div>
                                <div className="col-6"><Label>Collected By</Label><div>{ev?.collected_by_name}</div></div>
                                <div className="col-6"><Label>Collected At</Label><div>{ev?.collected_at ? formatDateTime(ev.collected_at) : ''}</div></div>
                                <div className="col-6"><Label>Status</Label><div>{ev?.status}</div></div>
                                <div className="col-6"><Label>File Name</Label><div className="small">{ev?.file_name}</div></div>
                                <div className="col-12"><Label>SHA-256 (Full)</Label><div className="small font-monospace" style={{ wordBreak: 'break-all' }}>{ev?.sha256}</div></div>
                                <div className="col-12"><Label>Storage Path</Label><div className="small">{ev?.file_path}</div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-shield-check me-2 text-warning" />Verify Integrity</h6>
                </div>
                <div className="card-body">
                    {overlay(verify)}
                    <button className="btn btn-navy btn-sm" onClick={doVerify} disabled={verify.busy}>{verify.busy ? 'Verifying...' : 'Verify Integrity'}</button>
                    {verifyResult && (
                        <div className="mt-2">
                            <div className={`alert ${verifyResult.match ? 'alert-success' : 'alert-danger'} small mb-0`}>
                                {verifyResult.match ? 'PASS: Hash matches stored SHA-256.' : 'FAIL: Hash does not match stored SHA-256.'}
                                <div className="small font-monospace mt-1">Computed: {verifyResult.computed}</div>
                                <div className="small font-monospace">Stored: {verifyResult.stored}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-arrow-left-right me-2 text-warning" />Record Transfer (Request/Approve)</h6>
                </div>
                <div className="card-body">
                    {overlay(transfer)}
                    <form onSubmit={submitTransferRequest} className="row g-2 mb-3">
                        <div className="col-md-3">
                            <select className="form-select form-select-sm" value={transferForm.to_user_id} onChange={(e) => setTransferForm(p => ({ ...p, to_user_id: e.target.value }))} required>
                                <option value="">Transfer To</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>)}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <input className="form-control form-control-sm" placeholder="Location" value={transferForm.location} onChange={(e) => setTransferForm(p => ({ ...p, location: e.target.value }))} />
                        </div>
                        <div className="col-md-4">
                            <input className="form-control form-control-sm" placeholder="Reason" value={transferForm.reason} onChange={(e) => setTransferForm(p => ({ ...p, reason: e.target.value }))} required />
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-navy btn-sm w-100" disabled={transfer.busy}>Request Transfer</button>
                        </div>
                    </form>
                    <h6 className="small fw-bold">Transfer Requests</h6>
                    {(transfers || []).length === 0 && <p className="text-muted small">None</p>}
                    {(transfers || []).map(t => (
                        <div key={t.id} className="d-flex align-items-center justify-content-between border rounded p-2 mb-2">
                            <div className="small">
                                <div>From: {t.from_user_name} → To: {t.to_user_name}</div>
                                <div className="text-muted">Status: {t.status} | Reason: {t.reason}</div>
                            </div>
                            {t.status === 'Requested' && (
                                <button className="btn btn-success btn-sm" onClick={() => approveTransfer(t.id)} disabled={transfer.busy}>Approve (Station Commander)</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-journal-text me-2 text-warning" />Add Note / Correction (append only)</h6>
                </div>
                <div className="card-body">
                    {overlay(note)}
                    <form onSubmit={submitNote} className="d-flex gap-2 mb-3">
                        <input className="form-control form-control-sm" placeholder="Add note/correction" value={noteText} onChange={(e) => setNoteText(e.target.value)} required />
                        <button className="btn btn-navy btn-sm" disabled={note.busy}>Add</button>
                    </form>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-clock-history me-2 text-warning" />Chain of Custody Timeline</h6>
                </div>
                <div className="card-body">
                    {(custody || []).length === 0 && <p className="text-muted small">No custody events</p>}
                    <ul className="list-unstyled mb-0">
                        {(custody || []).map(c => (
                            <li key={c.id} className="mb-2 pb-2 border-bottom">
                                <div className="small fw-semibold">{c.event_type}</div>
                                <div className="small text-muted">{c.event_at ? formatDateTime(c.event_at) : ''} | By: {c.recorded_by_name || ''}</div>
                                {c.notes && <div className="small">{c.notes}</div>}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
}
