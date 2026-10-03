import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initials } from '../lib/format';


export default function Topbar({ onToggleSidebar }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        const onClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <header className="topbar">
            <div className="d-flex align-items-center gap-3">
                <button
                    type="button"
                    className="btn btn-sm btn-outline-navy d-lg-none"
                    onClick={onToggleSidebar}
                    aria-label="Toggle navigation"
                >
                    <i className="bi bi-list" />
                </button>

                <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-building-shield text-muted fs-5 d-none d-md-inline" />
                    <span
                        className="fw-bold text-uppercase font-monospace text-muted small d-none d-md-inline"
                        style={{ letterSpacing: '0.05em' }}
                    >
                        Malawi Police Service — Limbe Station
                    </span>
                </div>
            </div>

            <div className="d-flex align-items-center gap-3">
                {user ? (
                    <div className="dropdown" ref={ref}>
                        <button
                            type="button"
                            className="d-flex align-items-center gap-2 border-0 bg-transparent dropdown-toggle py-1 px-2 rounded-2"
                            onClick={() => setOpen(v => !v)}
                            aria-expanded={open}
                            style={{ transition: 'background-color 0.15s ease' }}
                        >
                            <div
                                className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm"
                                style={{ width: 36, height: 36, backgroundColor: 'var(--mps-navy)', fontSize: '0.875rem' }}
                            >
                                {initials(user)}
                            </div>

                            <div className="text-start d-none d-sm-block">
                                <span className="fw-bold d-block lh-1 text-dark" style={{ fontSize: '0.8125rem' }}>
                                    {user.rank_title || 'Officer'} {user.last_name}
                                </span>
                                <small className="text-muted font-monospace d-block mt-1" style={{ fontSize: '0.72rem' }}>
                                    ID: {user.badge_number || 'N/A'}
                                </small>
                            </div>
                        </button>

                        {open && (
                            <ul
                                className="dropdown-menu dropdown-menu-end show shadow-md border-0 mt-2 p-0 overflow-hidden"
                                style={{ minWidth: 220, borderRadius: 'var(--mps-radius-md)' }}
                            >
                                <li className="p-3 bg-light border-bottom">
                                    <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.875rem' }}>
                                        {user.first_name} {user.last_name}
                                    </div>
                                    <span className="badge badge-case-open">{user.role}</span>
                                </li>
                                <li className="pt-1">
                                    <Link className="dropdown-item py-2 px-3 d-flex align-items-center gap-2" to="/change-password" style={{ fontSize: '0.85rem' }} onClick={() => setOpen(false)}>
                                        <i className="bi bi-key-fill text-warning" />
                                        <span>Change Password</span>
                                    </Link>
                                </li>
                                <li><hr className="dropdown-divider my-1" /></li>
                                <li className="pb-1">
                                    <button
                                        type="button"
                                        className="dropdown-item py-2 px-3 text-danger d-flex align-items-center gap-2 border-0 bg-transparent w-100"
                                        style={{ fontSize: '0.85rem' }}
                                        onClick={handleLogout}
                                    >
                                        <i className="bi bi-box-arrow-right" />
                                        <span>Sign Out</span>
                                    </button>
                                </li>
                            </ul>
                        )}
                    </div>
                ) : (
                    <Link to="/login" className="btn btn-navy btn-sm px-3">
                        <i className="bi bi-box-arrow-in-right me-1" /> Sign In
                    </Link>
                )}
            </div>
        </header>
    );
}
