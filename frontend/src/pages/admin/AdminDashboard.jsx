import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


function IconStat({ label, value, icon, tone }) {
    return (
        <div className="col-12 col-sm-6 col-xl-4">
            <div className="card border-0 shadow-sm p-3">
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <span className="text-muted small fw-semibold text-uppercase d-block mb-1">{label}</span>
                        <h3 className={`fw-bold mb-0 text-${tone}`}>{value}</h3>
                    </div>
                    <div className={`p-3 bg-${tone} bg-opacity-10 rounded text-${tone}`}>
                        <i className={`bi ${icon} fs-3`} />
                    </div>
                </div>
            </div>
        </div>
    );
}


export default function AdminDashboard() {
    const { data, error, loading } = useApiData(api.adminDashboard);
    usePageTitle('System Administration');

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const { stats, users, recentLogs } = data;

    return (
        <>
            <PageHeader
                title="System Administration Dashboard"
                subtitle="System health, quick administrative metrics, and recent security audit trail."
                actions={
                    <>
                        <Link to="/admin/users" className="btn btn-outline-navy fw-bold px-3">
                            <i className="bi bi-people me-2" />Manage Personnel
                        </Link>
                        <Link to="/admin/users/create" className="btn btn-navy fw-bold px-3">
                            <i className="bi bi-person-plus-fill me-2" />Register New Personnel
                        </Link>
                    </>
                }
            />

            <div className="row g-3 mb-4">
                <IconStat label="Total System Users" value={stats.totalUsers} icon="bi-people-fill" tone="primary" />
                <IconStat label="Active Accounts" value={stats.activeUsers} icon="bi-person-check-fill" tone="success" />
                <IconStat label="Total Logins Tracked" value={stats.totalLogins} icon="bi-shield-check" tone="dark" />
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-person-gear me-2 text-warning" />Recent Personnel &amp; Quick Actions</h6>
                    <Link to="/admin/users" className="btn btn-sm btn-outline-light">View Full Directory</Link>
                </div>
                <div className="table-responsive">
                    <table className="table align-middle mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th>Badge #</th>
                                <th>Name &amp; Rank</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr><td colSpan="5"><EmptyState message="No personnel records found." /></td></tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id}>
                                        <td className="small font-monospace fw-semibold">{user.badge_number}</td>
                                        <td className="fw-semibold small">
                                            {user.first_name} {user.last_name}
                                            {user.rank_title && <span className="d-block text-muted fw-normal">{user.rank_title}</span>}
                                        </td>
                                        <td><span className="badge bg-light text-dark border">{user.role}</span></td>
                                        <td>
                                            {user.is_active ? (
                                                <span className="badge bg-success bg-opacity-10 text-success fw-semibold">Active</span>
                                            ) : (
                                                <span className="badge bg-danger bg-opacity-10 text-danger fw-semibold">Inactive</span>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            <Link to={`/admin/users/${user.id}/edit`} className="btn btn-sm btn-outline-primary">
                                                <i className="bi bi-pencil-square me-1" />Edit
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-journal-text me-2 text-warning" />Recent System Activity &amp; Audit Trail</h6>
                    <Link to="/admin/audit-logs" className="btn btn-sm btn-outline-light">View Full Log</Link>
                </div>
                <div className="table-responsive">
                    <table className="table align-middle mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th>Timestamp</th>
                                <th>User / Officer</th>
                                <th>Action Performed</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentLogs.length === 0 ? (
                                <tr><td colSpan="4"><EmptyState message="No recent activity recorded." /></td></tr>
                            ) : (
                                recentLogs.map(log => (
                                    <tr key={log.id}>
                                        <td className="small text-muted font-monospace">{formatDateTime(log.created_at)}</td>
                                        <td className="fw-semibold small">
                                            {log.badge_number
                                                ? `${log.first_name} ${log.last_name} (${log.badge_number})`
                                                : 'System Process'}
                                        </td>
                                        <td><span className="badge bg-secondary">{log.action}</span></td>
                                        <td className="small">{log.details}</td>
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
