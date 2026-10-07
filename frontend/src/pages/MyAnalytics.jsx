import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../context/AuthContext';
import { roleFlags } from '../lib/roles';
import { Alert, PageHeader, Spinner } from '../components/ui';
import usePageTitle from '../hooks/usePageTitle';
import useReportExport from '../hooks/useReportExport';


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


export default function MyAnalytics() {
    const { user } = useAuth();
    const { requestReport, modal, busy: downloading } = useReportExport('My Case Report');
    const { isInvestigator } = roleFlags(user);
    const { data, error, loading } = useApiData(api.myAnalytics);
    usePageTitle('My Case Analytics');

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const {
        metrics,
        monthlyTrends,
        statusDistribution,
        categoryBreakdown,
        hotspots
    } = data;

    return (
        <>
            <PageHeader
                title="My Case Analytics"
                subtitle={isInvestigator
                    ? 'Trends and metrics for the cases assigned to you.'
                    : 'Trends and metrics for the cases you registered at the intake desk.'}
                actions={
                    <>
                        <button type="button" className="btn btn-navy btn-sm" onClick={() => requestReport('myCases')} disabled={downloading}>
                            <i className="bi bi-file-earmark-arrow-down me-1" />
                            {downloading ? 'Preparing...' : 'Export PDF Report'}
                        </button>
                        <Link to="/dashboard" className="btn btn-outline-navy btn-sm">
                            <i className="bi bi-arrow-left me-1" />Back to Dashboard
                        </Link>
                    </>
                }
            />

            <div className="row g-3 mb-4">
                <Metric label="Total Cases" value={metrics.totalCases} icon="bi-folder-fill" tone="navy" color="var(--mps-navy)" />
                <Metric label="Closed" value={metrics.closedCases} icon="bi-check-circle-fill" tone="success" color="var(--mps-success)" />
                <Metric label="Resolution Rate" value={`${metrics.resolutionRate}%`} icon="bi-graph-ups" tone="blue" color="var(--mps-info)" />
                <Metric label="Pending Requests" value={metrics.pendingRequests} icon="bi-hourglass-split" tone="warning" color="var(--mps-warning)" />
            </div>

            <div className="row g-4 mb-4">
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-bar-chart-line me-2 text-warning" />Monthly Trend</h6>
                        </div>
                        <div className="card-body">
                            {monthlyTrends.length === 0 ? (
                                <p className="text-muted small mb-0">No trend data available yet.</p>
                            ) : (
                                <table className="table table-sm align-middle mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th>Month</th>
                                            <th className="text-center">Cases</th>
                                            <th className="text-center">High / Critical</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthlyTrends.map(m => (
                                            <tr key={m.month_label}>
                                                <td className="small fw-semibold">{m.month_label}</td>
                                                <td className="text-center"><span className="badge bg-navy">{m.total_cases}</span></td>
                                                <td className="text-center">
                                                    <span className={`badge ${m.severe_cases > 0 ? 'badge-priority-critical' : 'bg-light text-dark border'}`}>
                                                        {m.severe_cases}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-pie-chart-fill me-2 text-warning" />Status Distribution</h6>
                        </div>
                        <div className="card-body">
                            {statusDistribution.length === 0 ? (
                                <p className="text-muted small mb-0">No cases on record.</p>
                            ) : (
                                statusDistribution.map(s => (
                                    <div className="d-flex justify-content-between align-items-center mb-2" key={s.status}>
                                        <span className="small fw-semibold">{s.status}</span>
                                        <span className="badge bg-light text-dark border">{s.total_count}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4">
                <div className="col-lg-7">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-diagram-3 me-2 text-warning" />Category Breakdown</h6>
                        </div>
                        <div className="card-body">
                            {categoryBreakdown.length === 0 ? (
                                <p className="text-muted small mb-0">No category data available.</p>
                            ) : (
                                <table className="table table-sm align-middle mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th>Crime Category</th>
                                            <th className="text-center">Cases</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categoryBreakdown.map(c => (
                                            <tr key={c.crime_category}>
                                                <td className="small fw-semibold">{c.crime_category}</td>
                                                <td className="text-center"><span className="badge bg-navy">{c.total_incidents}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-lg-5">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-geo-alt-fill me-2 text-warning" />Your Incident Locations</h6>
                        </div>
                        <div className="card-body">
                            {hotspots.length === 0 ? (
                                <p className="text-muted small mb-0">No location data available.</p>
                            ) : (
                                hotspots.map((h, i) => (
                                    <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom" key={h.location}>
                                        <span className="small fw-semibold">{i + 1}. {h.location}</span>
                                        <span className="badge bg-light text-dark border">{h.incident_count}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {modal}
        </>
    );
}
