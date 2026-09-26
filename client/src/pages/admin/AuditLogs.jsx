import { useState } from 'react';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


const ACTION_STYLES = {
    USER_LOGIN: 'bg-success',
    USER_LOGOUT: 'bg-secondary',
    USER_CREATED: 'bg-primary',
    USER_DELETED: 'bg-danger',
    USER_UPDATED: 'bg-info',
    PASSWORD_RESET: 'bg-warning text-dark',
    STATUS_CHANGE: 'bg-warning text-dark',
    STATUS_CHANGE_REQUESTED: 'bg-warning text-dark',
    CASE_REGISTERED: 'bg-primary',
    CASE_ASSIGNED: 'bg-info',
    CASE_REASSIGNED: 'bg-info',
    CASE_NOTE_ADDED: 'bg-secondary',
    EVIDENCE_LOGGED: 'bg-success',
    EVIDENCE_STATUS_CHANGED: 'bg-info',
    EVIDENCE_TRANSFERRED: 'bg-primary',
    EVIDENCE_DISPOSED: 'bg-danger',
    SUSPECT_LINKED: 'bg-secondary',
    VICTIM_LINKED: 'bg-secondary',
    LOGS_CLEARED: 'bg-danger'
};


function actionClass(action) {
    if (ACTION_STYLES[action]) return ACTION_STYLES[action];
    if (String(action).startsWith('STATUS_APPROVAL')) return 'bg-dark';
    return 'bg-dark';
}


export default function AuditLogs() {
    const toast = useToast();
    const [filters, setFilters] = useState({ search: '', action: '', role: '', date_from: '', date_to: '' });
    const [applied, setApplied] = useState({ search: '', action: '', role: '', date_from: '', date_to: '' });
    const [actionError, setActionError] = useState(null);
    const [clearing, setClearing] = useState(false);

    const { data, error, loading, reload } = useApiData((signal) => api.auditLogs(applied, signal));
    usePageTitle('Security Audit Logs');

    const logs = data?.logs || [];
    const actionTypes = data?.actionTypes || [];
    const roleTypes = data?.roleTypes || [];

    const set = (key) => (e) => setFilters(prev => ({ ...prev, [key]: e.target.value }));

    const reset = () => {
        const cleared = { search: '', action: '', role: '', date_from: '', date_to: '' };
        setFilters(cleared);
        setApplied(cleared);
    };

    const clearLogs = async () => {
        if (!window.confirm('Clear ALL security and audit trail logs? This cannot be undone.')) return;
        setClearing(true);
        setActionError(null);
        try {
            const res = await api.clearAuditLogs();
            toast.success(res.message);
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setClearing(false);
        }
    };

    return (
        <>
            <PageHeader
                title="System Security & Audit Trail Logs"
                subtitle="Immutable records of system actions, logins, user updates, and security events."
                actions={
                    <button type="button" className="btn btn-danger btn-sm" onClick={clearLogs} disabled={clearing}>
                        <i className="bi bi-trash3-fill me-1" />Clear Security Logs
                    </button>
                }
            />

            <Alert variant="danger" message={error} onDismiss={() => {}} />
            <Alert variant="danger" message={actionError} onDismiss={() => setActionError(null)} />

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-funnel-fill me-2 text-warning" />Filter Audit Logs</h6>
                </div>
                <div className="card-body">
                    <form onSubmit={(e) => { e.preventDefault(); setApplied(filters); }} className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label small text-muted fw-semibold mb-1">Search</label>
                            <input type="text" className="form-control form-control-sm" placeholder="Search details, badge number, name..." value={filters.search} onChange={set('search')} />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small text-muted fw-semibold mb-1">Action Type</label>
                            <select className="form-select form-select-sm" value={filters.action} onChange={set('action')}>
                                <option value="">All Actions</option>
                                {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small text-muted fw-semibold mb-1">User Role</label>
                            <select className="form-select form-select-sm" value={filters.role} onChange={set('role')}>
                                <option value="">All Roles</option>
                                {roleTypes.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small text-muted fw-semibold mb-1">From Date</label>
                            <input type="date" className="form-control form-control-sm" value={filters.date_from} onChange={set('date_from')} />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label small text-muted fw-semibold mb-1">To Date</label>
                            <input type="date" className="form-control form-control-sm" value={filters.date_to} onChange={set('date_to')} />
                        </div>
                        <div className="col-md-1 d-flex gap-1">
                            <button type="submit" className="btn btn-navy btn-sm flex-grow-1">
                                <i className="bi bi-search" />
                            </button>
                            <button type="button" className="btn btn-outline-navy btn-sm flex-grow-1" onClick={reset}>
                                <i className="bi bi-x-lg" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-dark text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-shield-shaded me-2" />Audit Trail Records</h6>
                    <span className="badge bg-secondary">{logs.length} Entries</span>
                </div>

                {loading ? <Spinner /> : (
                    <div className="table-responsive">
                        <table className="table align-middle table-hover mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th># Log ID</th>
                                    <th>Timestamp</th>
                                    <th>Officer / User</th>
                                    <th>Assigned Role</th>
                                    <th>Action Type</th>
                                    <th>Details</th>
                                    <th>IP Address</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="7">
                                            <EmptyState icon="bi-shield-check" message="No audit trail logs match your filter criteria." />
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map(log => (
                                        <tr key={log.id}>
                                            <td className="font-monospace small text-muted">#{log.id}</td>
                                            <td className="small font-monospace">{formatDateTime(log.created_at)}</td>
                                            <td className="fw-semibold small">
                                                {log.badge_number ? (
                                                    <>
                                                        {log.rank_title || ''} {log.first_name} {log.last_name}
                                                        <span className="d-block font-monospace text-primary" style={{ fontSize: '0.75rem' }}>{log.badge_number}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-muted">System / Unauthenticated</span>
                                                )}
                                            </td>
                                            <td><span className="badge bg-light text-dark border">{log.role || 'System'}</span></td>
                                            <td><span className={`badge ${actionClass(log.action)}`}>{log.action}</span></td>
                                            <td className="small text-secondary" style={{ maxWidth: 350, wordWrap: 'break-word' }}>{log.details}</td>
                                            <td className="small font-monospace text-muted">{log.ip_address || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
