import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Alert } from '../components/ui';
import usePageTitle from '../hooks/usePageTitle';


export default function ForgotPassword() {
    usePageTitle('Reset Password');

    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setSubmitting(true);

        try {
            const res = await api.forgotPassword(email);
            setMessage(res.message || 'If that email address is registered, a password reset link has been sent.');
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card card shadow-lg border-0" style={{ maxWidth: 400, width: '100%' }}>
                <div className="card-body p-4 p-md-5">
                    <div className="auth-header text-center mb-4">
                        <div className="auth-badge-icon mb-3">
                            <img src="/logo/image.png" alt="Limbe Police Emblem" style={{ maxWidth: 80, height: 'auto' }} />
                        </div>
                        <h4 className="fw-bold mb-1" style={{ color: '#001f3f' }}>Forgot Password</h4>
                        <div
                            className="text-uppercase font-monospace text-warning small fw-bold"
                            style={{ letterSpacing: '0.08em', fontSize: '0.75rem' }}
                        >
                            Password Reset Request
                        </div>
                    </div>

                    <div className="auth-body">
                        <Alert variant="danger" message={error} onDismiss={() => setError(null)} />
                        <Alert variant="success" message={message} onDismiss={() => setMessage(null)} />

                        {!message && (
                            <>
                                <p className="text-muted small mb-4">
                                    Enter the email address registered to your account. If it matches a record,
                                    we will send you a secure link to choose a new password.
                                </p>

                                <form onSubmit={handleSubmit}>
                                    <div className="mb-4">
                                        <label
                                            htmlFor="email"
                                            className="form-label text-uppercase text-muted fw-bold"
                                            style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}
                                        >
                                            Registered Email Address
                                        </label>
                                        <div className="input-group shadow-sm">
                                            <span className="input-group-text bg-white border-end-0">
                                                <i className="bi bi-envelope text-muted" />
                                            </span>
                                            <input
                                                type="email"
                                                className="form-control border-start-0 ps-0"
                                                id="email"
                                                name="email"
                                                placeholder="officer@example.com"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                required
                                                autoFocus
                                            />
                                        </div>
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
                                                Sending…
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-send me-2" />Send Reset Link
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}

                        <div className="text-center mt-4">
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
