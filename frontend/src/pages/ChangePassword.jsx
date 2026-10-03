import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Alert, PageHeader } from '../components/ui';
import PasswordInput from '../components/PasswordInput';
import usePageTitle from '../hooks/usePageTitle';


const MIN_PASSWORD_LENGTH = 6;


export default function ChangePassword() {
    const { user, homePath } = useAuth();
    const toast = useToast();
    usePageTitle('Change Password');

    const [form, setForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const res = await api.changePassword(form);
            toast.success(res.message || 'Password updated successfully!');
            setForm({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <PageHeader
                title="Change Password"
                subtitle="Update the credentials used to access the Case Management System."
                actions={
                    <Link to={homePath} className="btn btn-outline-navy btn-sm">
                        <i className="bi bi-arrow-left me-1" /> Return to Dashboard
                    </Link>
                }
            />

            <div className="row">
                <div className="col-lg-6">
                    <div className="card">
                        <div className="card-header">
                            <span><i className="bi bi-key-fill me-2 text-warning" />Update Credentials</span>
                            {user && <span className="float-end badge bg-secondary">Badge: {user.badge_number}</span>}
                        </div>
                        <div className="card-body">
                            <Alert variant="danger" message={error} onDismiss={() => setError(null)} />

                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label htmlFor="current_password" className="form-label">Current Password</label>
                                    <PasswordInput
                                        id="current_password"
                                        value={form.current_password}
                                        onChange={set('current_password')}
                                        autoComplete="current-password"
                                    />
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="new_password" className="form-label">New Password</label>
                                    <PasswordInput
                                        id="new_password"
                                        value={form.new_password}
                                        onChange={set('new_password')}
                                        autoComplete="new-password"
                                        minLength={MIN_PASSWORD_LENGTH}
                                    />
                                    <div className="form-text">Must be at least {MIN_PASSWORD_LENGTH} characters long.</div>
                                </div>

                                <div className="mb-4">
                                    <label htmlFor="confirm_password" className="form-label">Confirm New Password</label>
                                    <PasswordInput
                                        id="confirm_password"
                                        value={form.confirm_password}
                                        onChange={set('confirm_password')}
                                        autoComplete="new-password"
                                        minLength={MIN_PASSWORD_LENGTH}
                                    />
                                </div>

                                <button type="submit" className="btn btn-navy" disabled={submitting}>
                                    {submitting ? 'Updating…' : 'Update Password'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
