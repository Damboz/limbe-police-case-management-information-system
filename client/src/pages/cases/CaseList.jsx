import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


export default function CaseList() {
    const { data, error, loading } = useApiData(api.listCases);
    usePageTitle('Case Register');
    const cases = data?.cases || [];

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    return (
        <>
            <PageHeader
                title="Case Register"
                subtitle="All Occurrence Book (OB) entries recorded at Limbe Police Station."
                actions={
                    <Link to="/cases/new" className="btn btn-navy">
                        <i className="bi bi-plus-circle-fill me-1" />Register New Case
                    </Link>
                }
            />

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold">
                        <i className="bi bi-journal-text me-2 text-warning" />All Recorded Cases
                    </h6>
                    <span className="badge bg-gold text-dark">{cases.length} Total</span>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>OB Number</th>
                                <th>Complainant</th>
                                <th>Category</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Unit</th>
                                <th>Intake Officer</th>
                                <th>Assigned To</th>
                                <th>Date Registered</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cases.length === 0 ? (
                                <tr>
                                    <td colSpan="10">
                                        <EmptyState
                                            message="No cases have been registered yet."
                                            action={<Link to="/cases/new" className="small">Register the first case &rarr;</Link>}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                cases.map(item => (
                                    <tr key={item.id}>
                                        <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>{item.ob_number}</td>
                                        <td className="small fw-semibold">{item.complainant_name}</td>
                                        <td className="small">{item.crime_category || '—'}</td>
                                        <td><PriorityBadge priority={item.priority} /></td>
                                        <td><StatusBadge status={item.status} /></td>
                                        <td className="small text-muted">{item.unit_name || '—'}</td>
                                        <td className="small">{item.intake_officer_name || '—'}</td>
                                        <td className="small">
                                            {item.assigned_officer_name
                                                ? item.assigned_officer_name
                                                : <span className="text-muted fst-italic">Unassigned</span>}
                                        </td>
                                        <td className="small text-muted">{formatDate(item.created_at)}</td>
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
        </>
    );
}
