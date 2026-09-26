import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Alert } from '../components/ui';
import PasswordInput from '../components/PasswordInput';
import usePageTitle from '../hooks/usePageTitle';


export default function Login() {
    const { login, homePath } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    usePageTitle('Officer Sign In');

    const [badgeNumber, setBadgeNumber] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(location.state?.reason || null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const user = await login(badgeNumber, password);
            toast.success(`Welcome back, ${user.first_name || 'Officer'}.`);
            navigate(location.state?.from || homePath, { replace: true });
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
                        <h4 className="fw-bold mb-1" style={{ color: '#001f3f' }}>Limbe Police Station</h4>
                        <div
                            className="text-uppercase font-monospace text-warning small fw-bold"
                            style={{ letterSpacing: '0.08em', fontSize: '0.75rem' }}
                        >
                            Case Management System
                        </div>
                    </div>

                    <div className="auth-body">
                        <Alert variant="warning" message={notice} onDismiss={() => setNotice(null)} />
                        <Alert variant="danger" message={error} onDismiss={() => setError(null)} />

                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label
                                    htmlFor="badge_number"
                                    className="form-label text-uppercase text-muted fw-bold"
                                    style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}
                                >
                                    Username / Badge Number
                                </label>
                                <div className="input-group shadow-sm">
                                    <span className="input-group-text bg-white border-end-0">
                                        <i className="bi bi-person-badge text-muted" />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0 ps-0"
                                        id="badge_number"
                                        name="badge_number"
                                        placeholder="e.g. MPS-4821"
                                        value={badgeNumber}
                                        onChange={e => setBadgeNumber(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label
                                    htmlFor="password"
                                    className="form-label text-uppercase text-muted fw-bold mb-1"
                                    style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}
                                >
                                    Password
                                </label>
                                <PasswordInput
                                    id="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    label
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn w-100 py-2 shadow-sm mt-2 text-white fw-bold"
                                style={{ backgroundColor: 'rgb(2, 116, 176)' }}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                                        Signing in…
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-box-arrow-in-right me-2" />Sign In
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="p-3 bg-light text-center border-top rounded-bottom">
                    <small className="text-muted d-block fw-bold" style={{ fontSize: '0.75rem' }}>
                        <i className="bi bi-shield-lock-fill me-1 text-warning" />RESTRICTED PERSONNEL ACCESS
                    </small>
                    <small className="text-muted font-monospace d-block mt-1" style={{ fontSize: '0.6875rem' }}>
                        System access is strictly audited &amp; logged.
                    </small>
                </div>
            </div>
        </div>
    );
}
