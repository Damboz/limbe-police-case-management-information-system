import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../components/ui';
import CaseEvidenceButton from '../components/CaseEvidenceButton';
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
                                        <td><StatusBadge status={item.status} /></td>
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
                                            <CaseEvidenceButton caseId={item.id} status={item.status} />
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


export default function Dashboard() {
    const { data, error, loading } = useApiData(api.dashboard);
    usePageTitle('Dashboard');

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    if (data.variant === 'redirect') {
        return <Navigate to={data.target} replace />;
    }

    return <InvestigatorDashboard data={data} />;
}
