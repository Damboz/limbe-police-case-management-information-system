import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


function Metric({ label, value, icon, tone, color }) {
    return (
        <div className="col-12 col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm p-3">
                <div className="metric-card">
                    <div>
                        <span className="text-muted small fw-semibold text-uppercase d-block mb-1">{label}</span>
                        <h3 className="fw-bold mb-0" style={{ color }}>{value}</h3>
                    </div>
                    <div className={`metric-icon ${tone}`}><i className={`bi ${icon}`} /></div>
                </div>
            </div>
        </div>
    );
}


function Modal({ title, onClose, children, footer }) {
    return (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ background: 'rgba(15,23,42,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow">
                    <div className="modal-header bg-navy text-white">
                        <h5 className="modal-title fw-bold">{title}</h5>
                        <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose} />
                    </div>
                    {children}
                    {footer && <div className="modal-footer" style={{ backgroundColor: 'var(--mps-bg-subtle)' }}>{footer}</div>}
                </div>
            </div>
        </div>
    );
}


export default function ProsecutionDashboard() {
    const toast = useToast();
    const { data, error, loading, reload } = useApiData(api.prosecutionDashboard);
    usePageTitle('Prosecution Dashboard');

    const [ackTarget, setAckTarget] = useState(null);
    const [ackForm, setAckForm] = useState({ file_location: '', notes: '' });

    const [fileTarget, setFileTarget] = useState(null);
    const [fileLocation, setFileLocation] = useState('');

    const [courtTarget, setCourtTarget] = useState(null);
    const [courtForm, setCourtForm] = useState({ court_date: '', court_outcome: '' });

    const [queryTarget, setQueryTarget] = useState(null);
    const [queryText, setQueryText] = useState('');

    const [actionError, setActionError] = useState(null);
    const [busy, setBusy] = useState(false);

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const { kpi, forwardedCases, pendingReceipts, movingFiles } = data;

    const submitAcknowledge = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.acknowledgeReceipt(ackTarget.case_id, ackForm);
            toast.success(res.message || 'Receipt acknowledged.');
            setAckTarget(null);
            setAckForm({ file_location: '', notes: '' });
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const submitFileLocation = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.updateFileLocation(fileTarget.id, { file_location: fileLocation });
            toast.success(res.message || 'File location updated.');
            setFileTarget(null);
            setFileLocation('');
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const submitCourt = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.recordCourtDetails(courtTarget.id, courtForm);
            toast.success(res.message || 'Court details recorded.');
            setCourtTarget(null);
            setCourtForm({ court_date: '', court_outcome: '' });
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const submitQuery = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.sendQuery(queryTarget.id, { query: queryText });
            toast.success(res.message || 'Query sent to the Station Officer.');
            setQueryTarget(null);
            setQueryText('');
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <PageHeader
                title="Prosecution Dashboard"
                subtitle="File handover, court scheduling, and prosecution oversight for forwarded cases."
            />

            <Alert variant="danger" message={actionError} onDismiss={() => setActionError(null)} />

            <div className="row g-3 mb-4">
                <Metric label="Forwarded to Prosecution" value={kpi.forwarded} icon="bi-briefcase-fill" tone="navy" color="var(--mps-info)" />
                <Metric label="Awaiting File Receipt" value={kpi.pendingReceipts} icon="bi-inbox-fill" tone="warning" color="var(--mps-warning)" />
                <Metric label="Court Scheduled" value={kpi.scheduled} icon="bi-bank2" tone="success" color="var(--mps-success)" />
                <Metric label="Files Shelved" value={kpi.shelved} icon="bi-archive-fill" tone="danger" color="var(--mps-danger)" />
            </div>

            <div className="row g-4 mb-4">
                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-inbox-fill me-2 text-warning" />Pending File Handovers
                            </h6>
                            <span className="badge bg-gold text-dark">{pendingReceipts.length} To Receive</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case Ref</th>
                                        <th>Title &amp; Category</th>
                                        <th>Handed Over By</th>
                                        <th>Date</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingReceipts.length === 0 ? (
                                        <tr><td colSpan="5"><EmptyState icon="bi-inbox" message="No files waiting to be received." /></td></tr>
                                    ) : (
                                        pendingReceipts.map(item => (
                                            <tr key={item.custody_id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td className="small fw-semibold">{item.handed_over_by_name || '—'}</td>
                                                <td className="small text-muted">{formatDate(item.handed_over_at)}</td>
                                                <td className="text-end">
                                                    <button type="button" className="btn btn-sm btn-navy" onClick={() => { setAckTarget(item); setAckForm({ file_location: '', notes: '' }); setActionError(null); }}>
                                                        <i className="bi bi-box-arrow-in-down me-1" />Acknowledge
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-briefcase-fill me-2 text-warning" />Forwarded Cases
                            </h6>
                            <span className="badge bg-gold text-dark">{forwardedCases.length} Total</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case Ref</th>
                                        <th>Title &amp; Category</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {forwardedCases.length === 0 ? (
                                        <tr><td colSpan="5"><EmptyState message="No cases have been forwarded to the Prosecution Branch yet." /></td></tr>
                                    ) : (
                                        forwardedCases.map(item => (
                                            <tr key={item.id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td><PriorityBadge priority={item.priority} /></td>
                                                <td><StatusBadge status={item.status} /></td>
                                                <td className="text-end text-nowrap">
                                                    <div className="btn-group btn-group-sm">
                                                        <Link to={`/cases/${item.id}`} className="btn btn-outline-navy" title="Open Case">
                                                            <i className="bi bi-folder2-open" />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-navy"
                                                            title="Record Court Details"
                                                            onClick={() => { setCourtTarget(item); setCourtForm({ court_date: '', court_outcome: '' }); setActionError(null); }}
                                                        >
                                                            <i className="bi bi-bank2" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-navy"
                                                            title="Update File Location"
                                                            onClick={() => { setFileTarget(item); setFileLocation(item.file_location || ''); setActionError(null); }}
                                                        >
                                                            <i className="bi bi-archive" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-navy"
                                                            title="Query the Station Officer"
                                                            disabled={!!item.prosecution_query}
                                                            onClick={() => { setQueryTarget(item); setQueryText(''); setActionError(null); }}
                                                        >
                                                            <i className="bi bi-chat-square-text" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-12">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-journal-arrow-up me-2 text-warning" />Court Pipeline
                            </h6>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case Ref</th>
                                        <th>Title &amp; Category</th>
                                        <th>Court Date</th>
                                        <th>Outcome</th>
                                        <th>File Location</th>
                                        <th>Received By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movingFiles.length === 0 ? (
                                        <tr><td colSpan="6"><EmptyState message="No acknowledged file movements yet." /></td></tr>
                                    ) : (
                                        movingFiles.map(item => (
                                            <tr key={item.id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td className="small">{item.court_date ? formatDate(item.court_date) : '—'}</td>
                                                <td>{item.court_outcome ? <span className="badge badge-case-closed">{item.court_outcome}</span> : <span className="text-muted small">Pending</span>}</td>
                                                <td className="small">{item.file_location || '—'}</td>
                                                <td className="small">{item.received_by_name || '—'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {ackTarget && (
                <Modal
                    title="Acknowledge File Receipt"
                    onClose={() => setAckTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setAckTarget(null)}>Cancel</button>
                            <button type="submit" form="ack-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-check-lg me-1" />Confirm Receipt
                            </button>
                        </>
                    }
                >
                    <form id="ack-form" onSubmit={submitAcknowledge}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{ackTarget.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="ack_location" className="form-label">File Location (Physical Shelf)</label>
                                <input
                                    id="ack_location"
                                    className="form-control"
                                    placeholder="e.g. Prosecution shelf B3"
                                    value={ackForm.file_location}
                                    onChange={e => setAckForm(prev => ({ ...prev, file_location: e.target.value }))}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="ack_notes" className="form-label">Receipt Notes</label>
                                <textarea
                                    id="ack_notes"
                                    rows="3"
                                    className="form-control"
                                    placeholder="Optional observation on the file condition or contents..."
                                    value={ackForm.notes}
                                    onChange={e => setAckForm(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}

            {fileTarget && (
                <Modal
                    title="Update Physical File Location"
                    onClose={() => setFileTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setFileTarget(null)}>Cancel</button>
                            <button type="submit" form="file-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-check-lg me-1" />Save Location
                            </button>
                        </>
                    }
                >
                    <form id="file-form" onSubmit={submitFileLocation}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{fileTarget.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="file_location" className="form-label">File Location <span className="text-danger">*</span></label>
                                <input
                                    id="file_location"
                                    className="form-control"
                                    placeholder="e.g. Archives cabinet 2, shelf C"
                                    value={fileLocation}
                                    onChange={e => setFileLocation(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}

            {courtTarget && (
                <Modal
                    title="Record Court Details"
                    onClose={() => setCourtTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setCourtTarget(null)}>Cancel</button>
                            <button type="submit" form="court-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-check-lg me-1" />Save Court Details
                            </button>
                        </>
                    }
                >
                    <form id="court-form" onSubmit={submitCourt}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{courtTarget.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="court_date" className="form-label">Next / Last Court Date</label>
                                <input
                                    type="date"
                                    id="court_date"
                                    className="form-control"
                                    value={courtForm.court_date}
                                    onChange={e => setCourtForm(prev => ({ ...prev, court_date: e.target.value }))}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="court_outcome" className="form-label">Court Outcome</label>
                                <select
                                    id="court_outcome"
                                    className="form-select"
                                    value={courtForm.court_outcome}
                                    onChange={e => setCourtForm(prev => ({ ...prev, court_outcome: e.target.value }))}
                                >
                                    <option value="">— Not finalised —</option>
                                    <option value="Convicted">Convicted</option>
                                    <option value="Acquitted">Acquitted</option>
                                    <option value="Withdrawn">Withdrawn</option>
                                    <option value="Adjourned">Adjourned</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </Modal>
            )}

            {queryTarget && (
                <Modal
                    title="Query the Station Officer"
                    onClose={() => setQueryTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setQueryTarget(null)}>Cancel</button>
                            <button type="submit" form="query-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-send-fill me-1" />Send Query
                            </button>
                        </>
                    }
                >
                    <form id="query-form" onSubmit={submitQuery}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{queryTarget.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="query_text" className="form-label">Query Message <span className="text-danger">*</span></label>
                                <textarea
                                    id="query_text"
                                    rows="4"
                                    className="form-control"
                                    placeholder="What does the Prosecution Branch need from the Station Officer?"
                                    value={queryText}
                                    onChange={e => setQueryText(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}