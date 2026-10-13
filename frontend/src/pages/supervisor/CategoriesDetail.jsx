import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
import usePageTitle from '../../hooks/usePageTitle';


export default function CategoriesDetail() {
    const { data, error, loading } = useApiData(api.supervisorCategories);
    usePageTitle('Crime Category Breakdown');

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const { categories } = data;

    return (
        <>
            <PageHeader
                title="Crime Category Breakdown"
                subtitle="Full incident distribution across all crime categories recorded at the station."
                actions={
                    <>
                        <Link to="/supervisor/analytics" className="btn btn-outline-navy btn-sm">
                            <i className="bi bi-arrow-left me-1" />Back to Analytics
                        </Link>
                        <Link to="/supervisor/dashboard" className="btn btn-navy btn-sm">
                            <i className="bi bi-house-door-fill me-1" />Dashboard
                        </Link>
                    </>
                }
            />

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-table me-2 text-warning" />All Crime Categories</h6>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Category</th>
                                <th className="text-end">Cases</th>
                                <th className="text-end">Share</th>
                                <th className="text-end">Resolved Now</th>
                                <th className="text-end">Under Investigation</th>
                                <th className="text-end">High / Critical</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.length === 0 ? (
                                <tr><td colSpan="7"><EmptyState message="No category data available yet." /></td></tr>
                            ) : (
                                categories.map((c, i) => (
                                    <tr key={c.crime_category}>
                                        <td className="text-muted small">{i + 1}</td>
                                        <td className="small fw-semibold">{c.crime_category || 'N/A'}</td>
                                        <td className="text-end fw-bold small">{c.total_incidents || 0}</td>
                                        <td className="text-end small text-muted">{c.percentage || 0}%</td>
                                        <td className="text-end small" style={{ color: 'var(--mps-success)' }}>{c.closed_count || 0}</td>
                                        <td className="text-end small" style={{ color: 'var(--mps-warning)' }}>{c.active_count || 0}</td>
                                        <td className="text-end small" style={{ color: 'var(--mps-danger)' }}>{c.severe_count || 0}</td>
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
