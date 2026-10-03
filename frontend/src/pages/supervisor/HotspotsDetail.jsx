import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
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


export default function HotspotsDetail() {
    const { data, error, loading } = useApiData(api.supervisorHotspots);
    usePageTitle('Top Incident Hotspots');

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const { hotspots, metrics } = data;

    return (
        <>
            <PageHeader
                title="Top Incident Hotspots"
                subtitle="Full breakdown of reported incident locations across all recorded cases."
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
                <Metric label="Locations Tracked" value={metrics.locations || 0} icon="bi-geo-fill" tone="navy" color="var(--mps-navy)" />
                <Metric label="Total Incidents" value={metrics.totalIncidents || 0} icon="bi-folder-fill" tone="warning" color="var(--mps-navy)" />
                <Metric label="Resolved" value={metrics.totalResolved || 0} icon="bi-check-circle-fill" tone="success" color="var(--mps-success)" />
                <Metric label="Under Investigation" value={metrics.totalActive || 0} icon="bi-hourglass-split" tone="blue" color="var(--mps-warning)" />
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-table me-2 text-warning" />All Incident Hotspots</h6>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Location</th>
                                <th className="text-end">Incidents</th>
                                <th className="text-end">Share</th>
                                <th className="text-end">Resolved</th>
                                <th className="text-end">Under Investigation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hotspots.length === 0 ? (
                                <tr><td colSpan="6"><EmptyState message="No location data available yet." /></td></tr>
                            ) : (
                                hotspots.map((h, i) => (
                                    <tr key={h.location}>
                                        <td className="text-muted small">{i + 1}</td>
                                        <td className="small fw-semibold">{h.location}</td>
                                        <td className="text-end fw-bold small">{h.incident_count || 0}</td>
                                        <td className="text-end small text-muted">{h.share || 0}%</td>
                                        <td className="text-end small" style={{ color: 'var(--mps-success)' }}>{h.resolved_count || 0}</td>
                                        <td className="text-end small" style={{ color: 'var(--mps-warning)' }}>{h.active_count || 0}</td>
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
