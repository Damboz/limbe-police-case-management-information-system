import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { objectToParams, paramsKey, paramsToObject } from '../../lib/searchParams';
import usePageTitle from '../../hooks/usePageTitle';


const FILTER_KEYS = ['q', 'status', 'category', 'from', 'to'];


const STATUS_STYLES = {
    'In Locker': { bg: 'rgba(234, 88, 12, 0.15)', color: 'rgb(194, 65, 12)' },
    'Transferred to Lab': { bg: 'rgba(37, 99, 235, 0.15)', color: 'rgb(29, 78, 216)' },
    'Presented in Court': { bg: 'rgba(147, 51, 234, 0.15)', color: 'rgb(126, 34, 206)' },
    'Returned': { bg: 'rgba(100, 116, 139, 0.15)', color: 'rgb(71, 85, 105)' },
    'Disposed': { bg: 'rgba(220, 38, 38, 0.15)', color: 'rgb(185, 28, 28)' }
};


function StatusPill({ status }) {
    const style = STATUS_STYLES[status] || { bg: 'rgba(100, 116, 139, 0.15)', color: 'rgb(71, 85, 105)' };
    return <span className="badge fw-semibold" style={{ backgroundColor: style.bg, color: style.color }}>{status}</span>;
}


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


export default function EvidenceLedger() {
    const { user } = useAuth();
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    usePageTitle('Evidence Ledger');

    // Filters live in the query string so a filtered ledger can be shared or reloaded.
    const applied = paramsToObject(searchParams, FILTER_KEYS);
    const appliedKey = paramsKey(applied);

    const [filters, setFilters] = useState(applied);
    const [disposeTarget, setDisposeTarget] = useState(null);
    const [disposalReason, setDisposalReason] = useState('');
    const [actionError, setActionError] = useState(null);
    const [busy, setBusy] = useState(false);

    const { data, error, loading, reload } = useApiData(
        (signal) => api.evidenceLedger(applied, signal),
        [appliedKey]
    );

    const set = (key) => (e) => setFilters(prev => ({ ...prev, [key]: e.target.value }));

    // Keeps the draft inputs in step when the query string changes (e.g. Back button).
    useEffect(() => {
        setFilters(applied);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedKey]);

    const applyFilters = (e) => {
        e.preventDefault();
        setSearchParams(objectToParams(filters));
    };

    const reset = () => {
        setFilters({ q: '', status: '', category: '', from: '', to: '' });
        setSearchParams({});
    };

    const runAction = async (fn, successMessage) => {
        setBusy(true);
        setActionError(null);
        try {
            const res = await fn();
            toast.success(res.message || successMessage);
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const submitDisposal = async (e) => {
        e.preventDefault();
        if (!window.confirm('Permanently dispose this evidence item? This cannot be undone.')) return;
        await runAction(() => api.disposeEvidence(disposeTarget.id, { disposal_reason: disposalReason }), 'Evidence item disposed.');
        setDisposeTarget(null);
        setDisposalReason('');
    };

    if (loading && !data) return <Spinner />;

    const kpi = data?.kpi || {};
    const evidenceItems = data?.evidenceItems || [];
    const statusOptions = data?.statusOptions || [];
    const categories = data?.categories || [];
    const canUpdateStatus = data?.canUpdateStatus;

    return (
        <>
            <PageHeader
                title="Evidence Ledger"
                subtitle={user?.role === 'Station Commander'
                    ? 'Station-wide evidence oversight across all cases.'
                    : 'Evidence items logged against the cases assigned to you.'}
                actions={
                    <>
                        <Link to="/dashboard" className="btn btn-outline-navy btn-sm">
                            <i className="bi bi-arrow-left me-1" />Back to Dashboard
                        </Link>
                        <Link to="/cases" className="btn btn-navy btn-sm">
                            <i className="bi bi-folder2-open me-1" />Case Register
                        </Link>
                    </>
                }
            />

            <Alert variant="danger" message={error} onDismiss={() => {}} />
            <Alert variant="danger" message={actionError} onDismiss={() => setActionError(null)} />

            <div className="row g-4">
                <div className="col-12 col-lg-4 col-xl-3 order-lg-1">
                    <div className="filter-panel">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-navy text-white py-3">
                                <h6 className="mb-0 fw-bold">
                                    <i className="bi bi-funnel-fill me-2 text-warning" />Filter Evidence
                                </h6>
                            </div>
                            <div className="card-body">
                                <form onSubmit={applyFilters} className="row g-3">
                                    <div className="col-12">
                                        <label className="form-label small text-muted fw-semibold mb-1">Search</label>
                                        <input type="text" className="form-control form-control-sm" placeholder="Item #, description, location, case ref..." value={filters.q} onChange={set('q')} />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label small text-muted fw-semibold mb-1">Status</label>
                                        <select className="form-select form-select-sm" value={filters.status} onChange={set('status')}>
                                            <option value="">All Statuses</option>
                                            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label small text-muted fw-semibold mb-1">Category</label>
                                        <select className="form-select form-select-sm" value={filters.category} onChange={set('category')}>
                                            <option value="">All Categories</option>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label small text-muted fw-semibold mb-1">From</label>
                                        <input type="date" className="form-control form-control-sm" value={filters.from} onChange={set('from')} />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label small text-muted fw-semibold mb-1">To</label>
                                        <input type="date" className="form-control form-control-sm" value={filters.to} onChange={set('to')} />
                                    </div>
                                    <div className="col-12 d-grid gap-2">
                                        <button type="submit" className="btn btn-navy btn-sm">
                                            <i className="bi bi-search me-1" />Apply Filters
                                        </button>
                                        <button type="button" className="btn btn-outline-navy btn-sm" onClick={reset}>
                                            <i className="bi bi-x-lg me-1" />Reset
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-lg-8 col-xl-9 order-lg-2">
                    <div className="row g-3 mb-4">
                        <Metric label="Total Evidence Items" value={kpi.totalItems || 0} icon="bi-box-seam" tone="navy" color="var(--mps-navy)" />
                        <Metric label="In Locker" value={kpi.inLocker || 0} icon="bi-shield-lock" tone="warning" color="var(--mps-warning)" />
                        <Metric label="Transferred to Lab" value={kpi.transferred || 0} icon="bi-truck" tone="blue" color="var(--mps-blue)" />
                        <Metric label="In Court" value={kpi.inCourt || 0} icon="bi-gavel" tone="navy" color="var(--mps-info)" />
                        <Metric label="Returned / Disposed" value={(kpi.returned || 0) + (kpi.disposed || 0)} icon="bi-box-arrow-up-right" tone="success" color="var(--mps-success)" />
                        <Metric label="Cases Tracked" value={kpi.trackedCases || 0} icon="bi-folder-fill" tone="blue" color="var(--mps-blue)" />
                    </div>

                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-clipboard-check me-2 text-warning" />Evidence Items
                            </h6>
                            <span className="badge bg-gold text-dark">{evidenceItems.length} Shown</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case Ref</th>
                                        <th>Item</th>
                                        <th>Category</th>
                                        <th>Storage Location</th>
                                        <th>Collected By</th>
                                        <th>Collected</th>
                                        <th>Status</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {evidenceItems.length === 0 ? (
                                        <tr><td colSpan="8"><EmptyState message="No evidence items found." /></td></tr>
                                    ) : (
                                        evidenceItems.map(item => (
                                            <tr key={item.id}>
                                                <td>
                                                    <Link
                                                        to={`/cases/${item.case_id}`}
                                                        className="fw-bold font-monospace text-decoration-none"
                                                        style={{ color: 'var(--mps-navy)' }}
                                                    >
                                                        #{item.ob_number}
                                                    </Link>
                                                    {item.crime_category && <div><small className="text-muted">{item.crime_category}</small></div>}
                                                </td>
                                                <td>
                                                    <span className="fw-semibold font-monospace small">{item.item_number}</span>
                                                    <div className="small text-muted text-truncate" style={{ maxWidth: 220 }} title={item.description}>
                                                        {item.description}
                                                    </div>
                                                </td>
                                                <td><span className="badge bg-light text-dark border">{item.category}</span></td>
                                                <td className="small"><i className="bi bi-geo-alt me-1 text-muted" />{item.storage_location}</td>
                                                <td className="small">{item.collected_by_name || '—'}</td>
                                                <td className="small text-nowrap">{formatDate(item.collected_at)}</td>
                                                <td><StatusPill status={item.status || 'In Locker'} /></td>
                                                <td className="text-end">
                                                    {canUpdateStatus && item.status !== 'Disposed' ? (
                                                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-navy btn-sm"
                                                                title="Mark as presented in court"
                                                                disabled={busy}
                                                                onClick={() => {
                                                                    if (window.confirm('Mark this item as Presented in Court?')) {
                                                                        runAction(() => api.updateEvidenceStatus(item.id, { new_status: 'Presented in Court' }), 'Status updated.');
                                                                    }
                                                                }}
                                                            >
                                                                <i className="bi bi-gavel" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-navy btn-sm"
                                                                title="Transfer to Forensic Lab"
                                                                disabled={busy}
                                                                onClick={() => {
                                                                    if (window.confirm('Transfer this item to the Forensic Lab?')) {
                                                                        runAction(() => api.transferEvidence(item.id, { transfer_to: 'Forensic Lab' }), 'Evidence transferred.');
                                                                    }
                                                                }}
                                                            >
                                                                <i className="bi bi-truck" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-navy btn-sm"
                                                                title="Mark as returned"
                                                                disabled={busy}
                                                                onClick={() => {
                                                                    if (window.confirm('Mark this item as Returned?')) {
                                                                        runAction(() => api.updateEvidenceStatus(item.id, { new_status: 'Returned' }), 'Status updated.');
                                                                    }
                                                                }}
                                                            >
                                                                <i className="bi bi-box-arrow-left" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-danger btn-sm"
                                                                title="Dispose"
                                                                disabled={busy}
                                                                onClick={() => setDisposeTarget(item)}
                                                            >
                                                                <i className="bi bi-trash" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <Link to={`/cases/${item.case_id}`} className="btn btn-outline-navy btn-sm">
                                                            <i className="bi bi-eye me-1" />View Case
                                                        </Link>
                                                    )}
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

            {disposeTarget && (
                <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ background: 'rgba(15,23,42,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <form onSubmit={submitDisposal}>
                                <div className="modal-header bg-danger text-white">
                                    <h6 className="modal-title">
                                        <i className="bi bi-exclamation-triangle-fill me-1" />Dispose Evidence Item {disposeTarget.item_number}
                                    </h6>
                                    <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={() => setDisposeTarget(null)} />
                                </div>
                                <div className="modal-body text-start">
                                    <p className="small text-muted mb-3">Disposal is a permanent, audited action. Provide a reason for the audit trail.</p>
                                    <label className="form-label small fw-semibold">Disposal Reason <span className="text-danger">*</span></label>
                                    <textarea
                                        className="form-control"
                                        rows="2"
                                        required
                                        placeholder="e.g. Court order, returned to owner then registered, no evidentiary value..."
                                        value={disposalReason}
                                        onChange={e => setDisposalReason(e.target.value)}
                                    />
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setDisposeTarget(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
                                        <i className="bi bi-trash-fill me-1" />Confirm Disposal
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
