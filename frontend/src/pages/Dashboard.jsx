import { Link, Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../components/ui';
import { formatDate } from '../lib/format';
import usePageTitle from '../hooks/usePageTitle';


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


function InvestigatorDashboard({ data }) {
    const { kpi, assignedCases, overdueDaysThreshold } = data;

    return (
        <>
            <PageHeader
                title="My Assigned Cases"
                subtitle="Active investigations, evidence, and case timelines assigned to you."
            />

            <div className="row g-3 mb-4">
                <Metric label="Active Cases" value={kpi.active} icon="bi-search" tone="navy" color="var(--mps-navy)" />
                <Metric label={`Overdue (${overdueDaysThreshold}+ days)`} value={kpi.overdue} icon="bi-alarm-fill" tone="danger" color="var(--mps-danger)" />
                <Metric label="Pending Requests" value={kpi.pendingRequest} icon="bi-hourglass-split" tone="navy" color="var(--mps-info)" />
                <Metric label="Closed (All Time)" value={kpi.closed} icon="bi-check-circle-fill" tone="success" color="var(--mps-success)" />
            </div>

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


function RecordsDashboard() {
    return (
        <>
            <PageHeader
                title="Records Desk"
                subtitle="OB and criminal numbers are assigned to registered cases here."
            />
            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    <EmptyState
                        icon="bi-journal-text"
                        message="The numbering queue arrives with the Records Officer workflow."
                    />
                </div>
            </div>
        </>
    );
}


export default function Dashboard() {
    const { data, error, loading } = useApiData(api.dashboard);
    usePageTitle('Dashboard');

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    if (data.variant === 'redirect') {
        return <Navigate to={data.target} replace />;
    }

    if (data.variant === 'records') {
        return <RecordsDashboard />;
    }

    return <InvestigatorDashboard data={data} />;
}
