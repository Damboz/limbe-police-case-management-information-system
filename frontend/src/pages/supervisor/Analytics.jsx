import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
import ChartCanvas, { CHART_COLORS } from '../../components/ChartCanvas';
import usePageTitle from '../../hooks/usePageTitle';
import useReportExport from '../../hooks/useReportExport';


const STATUS_COLORS = {
    'Reported': CHART_COLORS.info,
    'Under Investigation': CHART_COLORS.warning,
    'Court Pending': CHART_COLORS.navy,
    'Closed': CHART_COLORS.success,
    'Archived': CHART_COLORS.slate
};


function Metric({ label, value, icon, tone, color, width = 'col-xl-4' }) {
    return (
        <div className={`col-12 col-sm-6 ${width}`}>
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


export default function Analytics() {
    const { data, error, loading } = useApiData(api.supervisorAnalytics);
    const { requestReport, modal, busy: downloading } = useReportExport('Crime Statistics Report');
    usePageTitle('Crime Trend Analytics & Hotspots');

    const monthlyData = useMemo(() => ({
        labels: (data?.monthlyTrends || []).map(m => m.month_label),
        datasets: [
            {
                label: 'Total Cases',
                data: (data?.monthlyTrends || []).map(m => m.total_cases),
                borderColor: CHART_COLORS.navy,
                backgroundColor: CHART_COLORS.navyFill,
                fill: true,
                tension: 0.3,
                pointRadius: 3
            },
            {
                label: 'High / Critical Priority',
                data: (data?.monthlyTrends || []).map(m => m.severe_cases),
                borderColor: CHART_COLORS.danger,
                backgroundColor: 'transparent',
                borderDash: [5, 4],
                tension: 0.3,
                pointRadius: 3
            }
        ]
    }), [data]);

    const statusData = useMemo(() => ({
        labels: (data?.statusDistribution || []).map(s => s.status),
        datasets: [{
            data: (data?.statusDistribution || []).map(s => s.total_count),
            backgroundColor: (data?.statusDistribution || []).map(s => STATUS_COLORS[s.status] || CHART_COLORS.slate),
            borderWidth: 2,
            borderColor: '#fff'
        }]
    }), [data]);

    const categoryData = useMemo(() => ({
        labels: (data?.categoryBreakdown || []).map(c => c.crime_category),
        datasets: [{
            label: 'Incidents',
            data: (data?.categoryBreakdown || []).map(c => c.total_incidents),
            backgroundColor: CHART_COLORS.gold,
            borderRadius: 4
        }]
    }), [data]);

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const { metrics, hotspots, categoryBreakdown } = data;

    return (
        <>
            <PageHeader
                title="Crime Trend Analytics & Hotspots"
                subtitle="Category distributions, monthly trends, and hotspot analysis for resource deployment."
                actions={
                    <>
                        <Link to="/supervisor/dashboard" className="btn btn-outline-navy btn-sm">
                            <i className="bi bi-arrow-left me-1" />Back to Dashboard
                        </Link>
                        <button type="button" className="btn btn-navy btn-sm" onClick={() => requestReport('crimeStatistics')} disabled={downloading}>
                            <i className="bi bi-file-earmark-pdf-fill me-1" />
                            {downloading ? 'Preparing...' : 'Export PDF'}
                        </button>
                    </>
                }
            />

            <div className="row g-3 mb-4">
                <Metric label="Total Cases Recorded" value={metrics.totalCases || 0} icon="bi-folder-fill" tone="navy" color="var(--mps-navy)" />
                <Metric label="Closed Cases" value={metrics.closedCases || 0} icon="bi-check-circle-fill" tone="success" color="var(--mps-success)" />
                <Metric label="Resolution Rate" value={`${metrics.resolutionRate || 0}%`} icon="bi-speedometer2" tone="blue" color="var(--mps-blue)" />
            </div>

            <div className="row g-4 mb-4">
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-bar-chart-line-fill me-2 text-warning" />Monthly Case Volume (Last 12 Months)
                            </h6>
                        </div>
                        <div className="card-body">
                            <ChartCanvas
                                type="line"
                                data={monthlyData}
                                height={110}
                                options={{
                                    responsive: true,
                                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-pie-chart-fill me-2 text-warning" />Status Distribution</h6>
                        </div>
                        <div className="card-body d-flex align-items-center justify-content-center">
                            <ChartCanvas
                                type="doughnut"
                                data={statusData}
                                options={{
                                    responsive: true,
                                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4 mb-4">
                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white py-3 d-flex align-items-center justify-content-between">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-tags-fill me-2 text-warning" />Crime Category Breakdown</h6>
                            <Link to="/supervisor/analytics/categories" className="btn btn-gold btn-sm">
                                <i className="bi bi-box-arrow-up-right me-1" />View Full Details
                            </Link>
                        </div>
                        <div className="card-body">
                            <ChartCanvas
                                type="bar"
                                data={categoryData}
                                height={220}
                                options={{
                                    indexAxis: 'y',
                                    responsive: true,
                                    plugins: { legend: { display: false } },
                                    scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
                                }}
                            />
                        </div>
                        <div className="table-responsive">
                            <table className="table table-sm align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th className="text-end">Incidents</th>
                                        <th className="text-end">Share</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(categoryBreakdown || []).map(cat => (
                                        <tr key={cat.crime_category}>
                                            <td className="small">{cat.crime_category || 'N/A'}</td>
                                            <td className="text-end small fw-semibold">{cat.total_incidents || 0}</td>
                                            <td className="text-end small text-muted">{cat.percentage || 0}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-geo-alt-fill me-2 text-warning" />Top Incident Hotspots</h6>
                            <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-gold text-dark">Top {hotspots.length}</span>
                                <Link to="/supervisor/analytics/hotspots" className="btn btn-gold btn-sm">
                                    <i className="bi bi-box-arrow-up-right me-1" />View Full Details
                                </Link>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Location</th>
                                        <th className="text-end">Incidents</th>
                                        <th className="text-end">Resolved</th>
                                        <th className="text-end">Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hotspots.length === 0 ? (
                                        <tr><td colSpan="4"><EmptyState message="No location data available yet." /></td></tr>
                                    ) : (
                                        hotspots.map((h, i) => (
                                            <tr key={h.location}>
                                                <td className="small">
                                                    <span className="badge bg-light text-dark border me-2">{i + 1}</span>
                                                    {h.location}
                                                </td>
                                                <td className="text-end fw-bold small">{h.incident_count || 0}</td>
                                                <td className="text-end small" style={{ color: 'var(--mps-success)' }}>{h.resolved_count || 0}</td>
                                                <td className="text-end small" style={{ color: 'var(--mps-warning)' }}>{h.active_count || 0}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {modal}
        </>
    );
}
