import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
import usePageTitle from '../../hooks/usePageTitle';


const ROLE_OPTIONS = [
    { value: '', label: 'All Roles' },
    { value: '6', label: 'Prosecutor' },
    { value: '5', label: 'Branch In-charge' },
    { value: '4', label: 'Counter/Intake Officer' },
    { value: '3', label: 'Investigating Officer' },
    { value: '2', label: 'Station Commander' },
    { value: '1', label: 'Admin' }
];


export default function Users() {
    const toast = useToast();
    const [filters, setFilters] = useState({ search: '', role: '' });
    const [applied, setApplied] = useState({ search: '', role: '' });
    const [actionError, setActionError] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const { data, error, loading, reload } = useApiData((signal) => api.listUsers(applied, signal));
    usePageTitle('Personnel Directory');

    const users = data?.users || [];

    const runAction = async (id, fn) => {
        setBusyId(id);
        setActionError(null);
        try {
            const res = await fn();
            toast.success(res.message);
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <>
            <PageHeader
                title="Personnel Directory"
                subtitle="Search, filter, and edit user profiles or access permissions."
                actions={
                    <Link to="/admin/users/create" className="btn btn-navy fw-bold px-3">
                        <i className="bi bi-person-plus-fill me-2" />Register New Personnel
                    </Link>
                }
            />

            <Alert variant="danger" message={error} onDismiss={() => {}} />
            <Alert variant="danger" message={actionError} onDismiss={() => setActionError(null)} />

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body p-3">
                    <form
                        className="row g-2 align-items-center"
                        onSubmit={(e) => { e.preventDefault(); setApplied(filters); }}
                    >
                        <div className="col-12 col-md-6">
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted" /></span>
                                <input
                                    type="text"
                                    className="form-control border-start-0"
                                    placeholder="Search by Badge, Name, or Email..."
                                    value={filters.search}
                                    onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="col-12 col-md-4">
                            <select
                                className="form-select"
                                value={filters.role}
                                onChange={(e) => {
                                    const role = e.target.value;
                                    setFilters(prev => ({ ...prev, role }));
                                    setApplied(prev => ({ ...prev, role }));
                                }}
                            >
                                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-md-2 d-grid">
                            <button type="submit" className="btn btn-navy fw-bold">Search</button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                {loading ? <Spinner /> : (
                    <div className="table-responsive">
                        <table className="table align-middle mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>Badge #</th>
                                    <th>Rank &amp; Name</th>
                                    <th>Contact Information</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr><td colSpan="6"><EmptyState message="No personnel records found." /></td></tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id}>
                                            <td className="font-monospace fw-bold" style={{ color: 'var(--mps-navy)' }}>{user.badge_number}</td>
                                            <td>
                                                <span className="fw-semibold">{user.first_name} {user.last_name}</span>
                                                {user.rank_title && <span className="d-block text-muted">{user.rank_title}</span>}
                                            </td>
                                            <td className="small">
                                                <div><i className="bi bi-envelope me-1 text-muted" />{user.email}</div>
                                                {user.phone_number && <div className="text-muted"><i className="bi bi-telephone me-1 text-muted" />{user.phone_number}</div>}
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
                                                <div className="btn-group">
                                                    <Link to={`/admin/users/${user.id}/edit`} className="btn btn-sm btn-outline-primary" title="Edit Profile">
                                                        <i className="bi bi-pencil-square me-1" />Edit
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm ms-1 ${user.is_active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                                        title={user.is_active ? 'Deactivate' : 'Activate'}
                                                        disabled={busyId === user.id}
                                                        onClick={() => runAction(user.id, () => api.toggleUserStatus(user.id))}
                                                    >
                                                        <i className={`bi ${user.is_active ? 'bi-person-x' : 'bi-person-check'}`} />
                                                    </button>
                                                    {!user.is_active && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger ms-1"
                                                            title="Delete Account"
                                                            disabled={busyId === user.id}
                                                            onClick={() => {
                                                                if (window.confirm('Permanently delete this deactivated account? This cannot be undone.')) {
                                                                    runAction(user.id, () => api.deleteUser(user.id));
                                                                }
                                                            }}
                                                        >
                                                            <i className="bi bi-trash3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
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
