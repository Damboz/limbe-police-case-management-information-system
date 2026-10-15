import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { useToast } from '../context/ToastContext';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner, StatCard, StatusBadge } from '../components/ui';
import { formatDate } from '../lib/format';
import usePageTitle from '../hooks/usePageTitle';


function DashboardSearchBar() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        navigate(`/cases/search?q=${encodeURIComponent(trimmed)}`);
    };

    return (
        <form onSubmit={handleSubmit} className="d-flex align-items-center gap-2" role="search">
            <div className="input-group" style={{ minWidth: '260px' }}>
                <span className="input-group-text bg-white border-end-0">
                    <i className="bi bi-search text-muted" />
                </span>
                <input
                    type="search"
                    className="form-control border-start-0"
                    placeholder="Search cases, IDs, suspects..."
                    aria-label="Search cases"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            <button type="submit" className="btn btn-navy text-nowrap">
                Search
            </button>
        </form>
    );
}


function InvestigatorDashboard({ data }) {
    const { kpi, assignedCases, overdueDaysThreshold } = data;

    return (
        <>
            <PageHeader
                title="My Assigned Cases"
                subtitle="Active investigations, evidence, and case timelines assigned to you."
                actions={<DashboardSearchBar />}
            />

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold">
                        <i className="bi bi-folder2-open me-2 text-warning" />Assigned Cases
                    </h6>
                    <span className="badge bg-gold text-dark">{kpi.totalAssigned} Total</span>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Case Ref</th>
                                <th>Title &amp; Category</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Days Open</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assignedCases.length === 0 ? (
                                <tr><td colSpan="6"><EmptyState message="No cases assigned to you yet." /></td></tr>
                            ) : (
                                assignedCases.map(item => (
                                    <tr key={item.id}>
                                        <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.ob_number}</td>
                                        <td>
                                            <div className="fw-semibold text-dark">{item.title}</div>
                                            <small className="text-muted">{item.crime_category}</small>
                                        </td>
                                        <td><PriorityBadge priority={item.priority} /></td>
                                        <td>
                                            {item.requested_status ? (
                                                <span className="badge bg-light text-dark border">
                                                    <i className="bi bi-hourglass-split me-1" />Pending: {item.requested_status}
                                                </span>
                                            ) : (
                                                <StatusBadge status={item.status} />
                                            )}
                                        </td>
                                        <td>
                                            {item.status === 'Under Investigation' && item.days_open > overdueDaysThreshold ? (
                                                <span className="badge badge-priority-critical">{item.days_open} days</span>
                                            ) : (
                                                <span className="text-muted small">{item.days_open} days</span>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            <Link to={`/cases/${item.id}`} className="btn btn-sm btn-navy">
                                                <i className="bi bi-folder2-open me-1" />Open Case
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}


function RecordsModal({ title, onClose, children, footer }) {
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


function RecordsDashboard({ data, reload }) {
    const toast = useToast();
    const { kpi, numberingQueue, recentlyNumbered } = data;

    const [target, setTarget] = useState(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState(null);

    const assignNumbers = async () => {
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.assignCaseNumbers(target.id, {});
            toast.success(res.message || 'Numbers assigned.');
            setTarget(null);
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
                title="Records Desk"
                subtitle="Assign OB and criminal numbers to registered cases before they are classified."
                actions={<DashboardSearchBar />}
            />

            <Alert variant="danger" message={actionError} onDismiss={() => setActionError(null)} />

            <div className="row g-3 mb-4">
                <div className="col-6 col-md-4">
                    <StatCard label="Awaiting Numbers" value={kpi.pending} icon="bi-hourglass-split" tone="navy" />
                </div>
                <div className="col-6 col-md-4">
                    <StatCard label="Numbered Today" value={kpi.numberedToday} icon="bi-check2-circle" tone="success" />
                </div>
                <div className="col-6 col-md-4">
                    <StatCard label="Total Numbered" value={kpi.totalNumbered} icon="bi-journal-check" tone="navy" />
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold">
                        <i className="bi bi-journal-text me-2 text-warning" />Numbering Queue
                    </h6>
                    <span className="badge bg-gold text-dark">{numberingQueue.length} Pending</span>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Case ID</th>
                                <th>Complainant</th>
                                <th>Category</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Branch</th>
                                <th>Recorded By</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {numberingQueue.length === 0 ? (
                                <tr>
                                    <td colSpan="8">
                                        <EmptyState icon="bi-check-circle-fill" message="No registered cases are awaiting numbers." />
                                    </td>
                                </tr>
                            ) : (
                                numberingQueue.map(item => (
                                    <tr key={item.id}>
                                        <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.id}</td>
                                        <td>
                                            <div className="fw-semibold text-dark">{item.complainant_name}</div>
                                            <small className="text-muted">{item.complainant_phone || '—'}</small>
                                        </td>
                                        <td className="small">{item.crime_category || '—'}</td>
                                        <td><PriorityBadge priority={item.priority} /></td>
                                        <td><StatusBadge status={item.status} /></td>
                                        <td className="small text-muted">{item.branch_name || '—'}</td>
                                        <td className="small">{item.recorded_by_name || '—'}</td>
                                        <td className="text-end text-nowrap">
                                            <button type="button" className="btn btn-sm btn-navy" onClick={() => { setTarget(item); setActionError(null); }}>
                                                <i className="bi bi-hash me-1" />Assign Numbers
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold">
                        <i className="bi bi-clock-history me-2 text-warning" />Recently Numbered
                    </h6>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>OB Number</th>
                                <th>Criminal Number</th>
                                <th>Complainant</th>
                                <th>Category</th>
                                <th>Assigned By</th>
                                <th>Assigned</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentlyNumbered.length === 0 ? (
                                <tr><td colSpan="7"><EmptyState message="No numbers have been assigned yet." /></td></tr>
                            ) : (
                                recentlyNumbered.map(item => (
                                    <tr key={item.id}>
                                        <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>{item.ob_number || '—'}</td>
                                        <td className="fw-semibold font-monospace">{item.criminal_number || '—'}</td>
                                        <td className="small fw-semibold">{item.complainant_name}</td>
                                        <td className="small">{item.crime_category || '—'}</td>
                                        <td className="small">{item.assigned_by_name || '—'}</td>
                                        <td className="small text-muted">{formatDate(item.numbers_assigned_at)}</td>
                                        <td className="text-end">
                                            <Link to={`/cases/${item.id}`} className="btn btn-sm btn-outline-navy">
                                                <i className="bi bi-eye-fill me-1" />View
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {target && (
                <RecordsModal
                    title="Assign OB & Criminal Numbers"
                    onClose={() => setTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setTarget(null)}>Cancel</button>
                            <button type="submit" form="assign-numbers-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-check-lg me-1" />Assign Numbers
                            </button>
                        </>
                    }
                >
                    <form id="assign-numbers-form" onSubmit={(e) => { e.preventDefault(); assignNumbers(); }}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE</label>
                                <div className="form-control-plaintext fw-bold">#{target.id} — {target.complainant_name}</div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">CATEGORY</label>
                                <div className="form-control-plaintext">{target.crime_category || '—'}</div>
                            </div>
                            <p className="text-muted small mb-0">
                                The next OB and criminal numbers will be drawn from the station registers and
                                recorded against this case. This moves the case to <strong>Numbered</strong>.
                            </p>
                        </div>
                    </form>
                </RecordsModal>
            )}
        </>
    );
}


export default function Dashboard() {
    const { data, error, loading, reload } = useApiData(api.dashboard);
    usePageTitle('Dashboard');

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    if (data.variant === 'redirect') {
        return <Navigate to={data.target} replace />;
    }

    if (data.variant === 'records') {
        return <RecordsDashboard data={data} reload={reload} />;
    }

    return <InvestigatorDashboard data={data} />;
}
