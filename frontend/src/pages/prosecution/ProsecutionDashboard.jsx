import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


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


function Stat({ label, value, icon, colorClass }) {
    return (
        <div className="col-6 col-md-4">
            <div className="card border-0 shadow-sm p-3 h-100">
                <div className="d-flex flex-column align-items-center text-center">
                    <i className={`bi ${icon} fs-4 mb-1 text-${colorClass}`} />
                    <h5 className="fw-bold mb-0">{value}</h5>
                    <span className="text-muted small fw-semibold text-uppercase d-block mt-1">{label}</span>
                </div>
            </div>
        </div>
    );
}


export default function ProsecutionDashboard() {
    const toast = useToast();
    const { data, error, loading, reload } = useApiData(api.prosecutionDashboard);
    usePageTitle('Prosecution Dashboard');

    const [forwardTarget, setForwardTarget] = useState(null);
    const [forwardForm, setForwardForm] = useState({ court_date: '', court_officer_id: '', notes: '' });

    const [actionError, setActionError] = useState(null);
    const [busy, setBusy] = useState(false);

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const { forwardedCases, courtCases, courtOfficers, kpi } = data;

    const openForward = (item) => {
        setForwardTarget(item);
        setForwardForm({ court_date: '', court_officer_id: '', notes: '' });
        setActionError(null);
    };

    const submitForward = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.forwardCaseToCourt(forwardTarget.id, forwardForm);
            toast.success(res.message || 'Case forwarded to court.');
            setForwardTarget(null);
            setForwardForm({ court_date: '', court_officer_id: '', notes: '' });
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
                subtitle="Forward prosecution cases to court and assign the officer who will stand with each case."
            />

            <Alert variant="danger" message={actionError} onDismiss={() => setActionError(null)} />

            <div className="row g-3 mb-4">
                <Stat label="Awaiting Court Forwarding" value={kpi.forwarded} icon="bi-briefcase-fill" colorClass="warning" />
                <Stat label="Court Pending" value={kpi.courtPending} icon="bi-bank2" colorClass="primary" />
                <Stat label="In Court Today" value={kpi.inCourtToday} icon="bi-calendar-check-fill" colorClass="success" />
            </div>

            <div className="row g-4 mb-4">
                <div className="col-12">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-briefcase-fill me-2 text-warning" />Cases Forwarded to Prosecution
                            </h6>
                            <span className="badge bg-gold text-dark">{forwardedCases.length} Awaiting Court</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case Ref</th>
                                        <th>Title &amp; Category</th>
                                        <th>Priority</th>
                                        <th>Investigator(s)</th>
                                        <th>Forwarded</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {forwardedCases.length === 0 ? (
                                        <tr><td colSpan="6"><EmptyState icon="bi-briefcase" message="No cases are awaiting court forwarding." /></td></tr>
                                    ) : (
                                        forwardedCases.map(item => (
                                            <tr key={item.id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td><PriorityBadge priority={item.priority} /></td>
                                                <td><small className="fw-semibold">{item.investigator_names || '—'}</small></td>
                                                <td className="small text-muted">{item.forwarded_at ? formatDate(item.forwarded_at) : '—'}</td>
                                                <td className="text-end text-nowrap">
                                                    <div className="btn-group btn-group-sm">
                                                        <Link to={`/cases/${item.id}`} className="btn btn-outline-navy" title="Open Case">
                                                            <i className="bi bi-folder2-open" />
                                                        </Link>
                                                        <button type="button" className="btn btn-navy" onClick={() => openForward(item)}>
                                                            <i className="bi bi-bank2 me-1" />Forward to Court
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
                                        <th>Officer Standing with Case</th>
                                        <th>Outcome</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {courtCases.length === 0 ? (
                                        <tr><td colSpan="6"><EmptyState message="No cases have been forwarded to court yet." /></td></tr>
                                    ) : (
                                        courtCases.map(item => (
                                            <tr key={item.id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td className="small">{item.court_date ? formatDate(item.court_date) : '—'}</td>
                                                <td className="small">
                                                    <div className="fw-semibold">{item.court_officer_name || '—'}</div>
                                                    {item.court_officer_badge && <span className="text-muted">{item.court_officer_badge}</span>}
                                                </td>
                                                <td>{item.court_outcome ? <span className="badge badge-case-closed">{item.court_outcome}</span> : <span className="text-muted small">Pending</span>}</td>
                                                <td><StatusBadge status={item.status} /></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {forwardTarget && (
                <Modal
                    title="Forward Case to Court"
                    onClose={() => setForwardTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setForwardTarget(null)}>Cancel</button>
                            <button type="submit" form="forward-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-bank2 me-1" />Forward to Court
                            </button>
                        </>
                    }
                >
                    <form id="forward-form" onSubmit={submitForward}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{forwardTarget.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="court_date" className="form-label">Court Date <span className="text-danger">*</span></label>
                                <input
                                    type="date"
                                    id="court_date"
                                    className="form-control"
                                    value={forwardForm.court_date}
                                    onChange={e => setForwardForm(prev => ({ ...prev, court_date: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="court_officer_id" className="form-label">Officer Standing with the Case <span className="text-danger">*</span></label>
                                <select
                                    id="court_officer_id"
                                    className="form-select"
                                    value={forwardForm.court_officer_id}
                                    onChange={e => setForwardForm(prev => ({ ...prev, court_officer_id: e.target.value }))}
                                    required
                                >
                                    <option value="">— Select an officer —</option>
                                    {courtOfficers.map(officer => (
                                        <option key={officer.id} value={officer.id}>
                                            {officer.rank_title} {officer.first_name} {officer.last_name} ({officer.badge_number})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="forward_notes" className="form-label">Notes</label>
                                <textarea
                                    id="forward_notes"
                                    rows="3"
                                    className="form-control"
                                    placeholder="Optional instructions for the officer standing with the case..."
                                    value={forwardForm.notes}
                                    onChange={e => setForwardForm(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}
