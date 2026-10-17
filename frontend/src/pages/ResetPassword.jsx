import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Alert } from '../components/ui';
import PasswordInput from '../components/PasswordInput';
import usePageTitle from '../hooks/usePageTitle';


const MIN_PASSWORD_LENGTH = 6;


export default function ResetPassword() {
    usePageTitle('Set New Password');

    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [form, setForm] = useState({ new_password: '', confirm_password: '' });
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const res = await api.resetPassword({
                token,
                new_password: form.new_password,
                confirm_password: form.confirm_password
            });
            setMessage(res.message || 'Your password has been reset successfully.');
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const linkExpired = error && /invalid|expired|used/i.test(error);

    return (
        <div className="auth-wrapper">
            <div className="auth-card card shadow-lg border-0" style={{ maxWidth: 400, width: '100%' }}>
                <div className="card-body p-4 p-md-5">
                    <div className="auth-header text-center mb-4">
                        <div className="auth-badge-icon mb-3">
                            <img src="/logo/image.png" alt="Limbe Police Emblem" style={{ maxWidth: 80, height: 'auto' }} />
                        </div>
                        <h4 className="fw-bold mb-1" style={{ color: '#001f3f' }}>Set New Password</h4>
                        <div
                            className="text-uppercase font-monospace text-warning small fw-bold"
                            style={{ letterSpacing: '0.08em', fontSize: '0.75rem' }}
                        >
                            Choose a New Password
                        </div>
                    </div>

                    <div className="auth-body">
                        <Alert variant="success" message={message} onDismiss={() => setMessage(null)} />
                        <Alert variant="danger" message={error} onDismiss={() => setError(null)} />

                        {!token && !message && (
                            <Alert
                                variant="warning"
                                message="This page needs a valid reset link. Please use the link from your email or request a new one."
                            />
                        )}

                        {!message && token && (
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label
                                        htmlFor="new_password"
                                        className="form-label text-uppercase text-muted fw-bold mb-1"
                                        style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}
                                    >
                                        New Password
                                    </label>
                                    <PasswordInput
                                        id="new_password"
                                        value={form.new_password}
                                        onChange={set('new_password')}
                                        label
                                        autoComplete="new-password"
                                        minLength={MIN_PASSWORD_LENGTH}
                                    />
                                    <div className="form-text">Must be at least {MIN_PASSWORD_LENGTH} characters long.</div>
                                </div>

                                <div className="mb-4">
                                    <label
                                        htmlFor="confirm_password"
                                        className="form-label text-uppercase text-muted fw-bold mb-1"
                                        style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}
                                    >
                                        Confirm New Password
                                    </label>
                                    <PasswordInput
                                        id="confirm_password"
                                        value={form.confirm_password}
                                        onChange={set('confirm_password')}
                                        label
                                        autoComplete="new-password"
                                        minLength={MIN_PASSWORD_LENGTH}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="btn w-100 py-2 shadow-sm text-white fw-bold"
                                    style={{ backgroundColor: 'rgb(2, 116, 176)' }}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                                            Resetting…
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-shield-lock me-2" />Reset Password
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        <div className="text-center mt-4">
                            {linkExpired && (
                                <div className="mb-2">
                                    <Link to="/forgot-password" className="small text-decoration-none fw-bold">
                                        Request a new reset link
                                    </Link>
                                </div>
                            )}
                            <Link to="/login" className="small text-decoration-none">
                                <i className="bi bi-arrow-left me-1" />Back to Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
