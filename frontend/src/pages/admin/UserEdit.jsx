import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import PasswordInput from '../../components/PasswordInput';
import usePageTitle from '../../hooks/usePageTitle';


const MIN_PASSWORD_LENGTH = 6;

const ROLE_OPTIONS = [
    { value: 'Officer', label: 'Officer' },
    { value: 'Investigator', label: 'Investigator' },
    { value: 'Supervisor', label: 'Supervisor' },
    { value: 'Branch In-charge', label: 'Branch In-charge' },
    { value: 'Prosecutor', label: 'Prosecutor' },
    { value: 'Admin', label: 'System Administrator' }
];


function toRoleValue(role) {
    switch (role) {
        case 'Investigating Officer': return 'Investigator';
        case 'Station Commander': return 'Supervisor';
        case 'Counter/Intake Officer': return 'Officer';
        case 'Branch In-charge': return 'Branch In-charge';
        case 'Prosecutor': return 'Prosecutor';
        case 'Admin': return 'Admin';
        default: return role || 'Officer';
    }
}


export default function UserEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    usePageTitle('Edit Officer Profile');

    const { data, error, loading, reload } = useApiData((signal) => api.getUser(id, signal));

    const [form, setForm] = useState(null);
    const [passwords, setPasswords] = useState({ new_password: '', confirm_password: '' });
    const [profileError, setProfileError] = useState(null);
    const [passwordError, setPasswordError] = useState(null);
    const [statusError, setStatusError] = useState(null);
    const [busy, setBusy] = useState(null);

    useEffect(() => {
        if (data?.userToEdit) {
            const u = data.userToEdit;
            setForm({
                rank_title: u.rank_title || '',
                first_name: u.first_name || '',
                last_name: u.last_name || '',
                email: u.email || '',
                phone_number: u.phone_number || '',
                role: toRoleValue(u.role),
                unit_id: u.unit_id || ''
            });
        }
    }, [data]);

    const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
    const setDigits = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value.replace(/[^0-9]/g, '') }));

    const saveProfile = async (e) => {
        e.preventDefault();
        setBusy('profile');
        setProfileError(null);
        try {
            const res = await api.updateUser(id, form);
            toast.success(res.message);
            reload();
        } catch (err) {
            setProfileError(err.message);
        } finally {
            setBusy(null);
        }
    };

    const resetPassword = async (e) => {
        e.preventDefault();
        setBusy('password');
        setPasswordError(null);
        try {
            const res = await api.resetUserPassword(id, passwords);
            toast.success(res.message);
            setPasswords({ new_password: '', confirm_password: '' });
        } catch (err) {
            setPasswordError(err.message);
        } finally {
            setBusy(null);
        }
    };

    const toggleStatus = async () => {
        setBusy('status');
        setStatusError(null);
        try {
            const res = await api.toggleUserStatus(id);
            toast.success(res.message);
            reload();
        } catch (err) {
            setStatusError(err.message);
        } finally {
            setBusy(null);
        }
    };

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;
    if (!form) return <Spinner />;

    const user = data.userToEdit;

    return (
        <>
            <PageHeader
                title="Edit Officer Profile"
                subtitle={`Updating records for ${user.rank_title || 'Officer'} ${user.first_name} ${user.last_name} (Badge: ${user.badge_number})`}
                actions={
                    <>
                        <Link to="/admin/users" className="btn btn-outline-secondary btn-sm fw-bold">
                            <i className="bi bi-arrow-left me-1" />Back to Directory
                        </Link>
                        <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => navigate('/admin/users')}>
                            Done
                        </button>
                    </>
                }
            />

            <div className="row g-4 col-lg-11 mx-auto">
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-navy text-white py-3 d-flex align-items-center justify-content-between">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-person-lines-fill me-2" />Personal &amp; Role Information</h6>
                            <span className={`badge ${user.is_active ? 'bg-success' : 'bg-danger'}`}>
                                {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div className="card-body p-4">
                            <Alert variant="danger" message={profileError} onDismiss={() => setProfileError(null)} />

                            <form onSubmit={saveProfile}>
                                <div className="row g-3 mb-3">
                                    <div className="col-md-6">
                                        <label className="form-label small fw-semibold text-muted">Badge / ID Number</label>
                                        <input type="text" className="form-control bg-light" value={user.badge_number} readOnly disabled />
                                        <div className="form-text">Badge numbers cannot be modified.</div>
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="rank_title" className="form-label small fw-semibold text-muted">Rank / Title</label>
                                        <input type="text" className="form-control" placeholder="e.g. Constable, Inspector" value={form.rank_title} onChange={set('rank_title')} />
                                    </div>
                                </div>

                                <div className="row g-3 mb-3">
                                    <div className="col-md-6">
                                        <label htmlFor="first_name" className="form-label small fw-semibold text-muted">First Name *</label>
                                        <input type="text" className="form-control" value={form.first_name} onChange={set('first_name')} required />
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="last_name" className="form-label small fw-semibold text-muted">Last Name *</label>
                                        <input type="text" className="form-control" value={form.last_name} onChange={set('last_name')} required />
                                    </div>
                                </div>

                                <div className="row g-3 mb-3">
                                    <div className="col-md-6">
                                        <label htmlFor="email" className="form-label small fw-semibold text-muted">Email Address *</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            id="email"
                                            pattern="[^@\s]+@[^@\s]+"
                                            title="Must contain an @ symbol, e.g. name@police.gov.mw"
                                            value={form.email}
                                            onChange={set('email')}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="phone_number" className="form-label small fw-semibold text-muted">Phone Number</label>
                                        <input
                                            type="tel"
                                            className="form-control"
                                            id="phone_number"
                                            placeholder="e.g. 0888123456"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            title="Numbers only"
                                            value={form.phone_number}
                                            onChange={setDigits('phone_number')}
                                        />
                                    </div>
                                </div>

                                <div className="row g-3 mb-4">
                                    <div className="col-md-6">
                                        <label htmlFor="role" className="form-label small fw-semibold text-muted">System Assignment / Role *</label>
                                        <select className="form-select" id="role" value={form.role} onChange={set('role')} required>
                                            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="unit_id" className="form-label small fw-semibold text-muted">Assigned Unit</label>
                                        <select className="form-select" id="unit_id" value={form.unit_id} onChange={set('unit_id')}>
                                            <option value="">No unit assigned</option>
                                            {(data.units || []).map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-end gap-2">
                                    <Link to="/admin/users" className="btn btn-light border px-4">Cancel</Link>
                                    <button type="submit" className="btn btn-navy px-4 fw-bold" disabled={busy === 'profile'}>
                                        <i className="bi bi-save me-1" />
                                        {busy === 'profile' ? 'Saving…' : 'Save Profile'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-shield-lock-fill me-2" />Reset Password</h6>
                        </div>
                        <div className="card-body p-4">
                            <Alert variant="danger" message={passwordError} onDismiss={() => setPasswordError(null)} />

                            <form onSubmit={resetPassword}>
                                <div className="mb-3">
                                    <label htmlFor="new_password" className="form-label small fw-semibold text-muted">New Password</label>
                                    <PasswordInput
                                        id="new_password"
                                        value={passwords.new_password}
                                        onChange={e => setPasswords(prev => ({ ...prev, new_password: e.target.value }))}
                                        placeholder={`Min ${MIN_PASSWORD_LENGTH} characters`}
                                        autoComplete="new-password"
                                        minLength={MIN_PASSWORD_LENGTH}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="confirm_password" className="form-label small fw-semibold text-muted">Confirm New Password</label>
                                    <PasswordInput
                                        id="confirm_password"
                                        value={passwords.confirm_password}
                                        onChange={e => setPasswords(prev => ({ ...prev, confirm_password: e.target.value }))}
                                        placeholder="Repeat new password"
                                        autoComplete="new-password"
                                        minLength={MIN_PASSWORD_LENGTH}
                                    />
                                </div>
                                <button type="submit" className="btn btn-warning w-100 fw-bold mt-2" disabled={busy === 'password'}>
                                    <i className="bi bi-key-fill me-1" />
                                    {busy === 'password' ? 'Updating…' : 'Update Password'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold"><i className="bi bi-toggle-on me-2" />Account Status</h6>
                        </div>
                        <div className="card-body p-4 text-center">
                            <Alert variant="danger" message={statusError} onDismiss={() => setStatusError(null)} />

                            <p className="small text-muted mb-3">
                                Current Status:{' '}
                                <strong className={user.is_active ? 'text-success' : 'text-danger'}>
                                    {user.is_active ? 'Active' : 'Inactive / Suspended'}
                                </strong>
                            </p>
                            <button
                                type="button"
                                className={`btn ${user.is_active ? 'btn-outline-danger' : 'btn-outline-success'} w-100 fw-bold`}
                                onClick={toggleStatus}
                                disabled={busy === 'status'}
                            >
                                <i className={`bi ${user.is_active ? 'bi-person-x-fill' : 'bi-person-check-fill'} me-1`} />
                                {user.is_active ? 'Deactivate Account' : 'Activate Account'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
