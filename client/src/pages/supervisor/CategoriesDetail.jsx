import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
import usePageTitle from '../../hooks/usePageTitle';


function Metric({ label, value, icon, tone, color }) {
    return (
        <div className="col-12 col-sm-6 col-xl-4">
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


export default function CategoriesDetail() {
    const { data, error, loading } = useApiData(api.supervisorCategories);
    usePageTitle('Crime Category Breakdown');

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const { categories, metrics } = data;

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

            <div className="row g-3 mb-4">
                <Metric label="Categories Tracked" value={metrics.categories || 0} icon="bi-tags" tone="navy" color="var(--mps-navy)" />
                <Metric label="Total Cases" value={metrics.totalCases || 0} icon="bi-folder-fill" tone="warning" color="var(--mps-warning)" />
                <Metric label="Closed Cases" value={metrics.totalClosed || 0} icon="bi-check-circle-fill" tone="success" color="var(--mps-success)" />
            </div>

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
