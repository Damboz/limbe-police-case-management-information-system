import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleFlags } from '../lib/roles';
import { initials } from '../lib/format';


function linkClass({ isActive }) {
    return `sidebar-link${isActive ? ' active' : ''}`;
}


export default function Sidebar({ open = false, onClose = () => {} }) {
    const { user, logout, homePath } = useAuth();
    const navigate = useNavigate();
    const { isInvestigator, isCommander, isAdmin, isIntake } = roleFlags(user);

    const close = () => onClose();

    const handleLogout = async () => {
        close();
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <>
            {open && <div className="d-lg-none position-fixed top-0 start-0 w-100 h-100" style={{ background: 'rgba(15,23,42,0.5)', zIndex: 1035 }} onClick={close} />}

            <aside className={`sidebar ${open ? 'd-block' : 'd-none d-lg-block'}`}>
                <div className="sidebar-brand d-flex align-items-center">
                    <div className="sidebar-logo-container me-2">
                        <img src="/logo/image.png" alt="Limbe Police Emblem" className="sidebar-logo" />
                    </div>
                    <div className="lh-sm">
                        <div className="fw-bold text-white fs-6">Limbe Police Station</div>
                        <small className="text-white-50 d-block" style={{ fontSize: '0.7rem' }}>Case Management Information System</small>
                    </div>
                </div>

                <ul className="sidebar-menu">
                    <li className="sidebar-heading">Core Operations</li>

                    <li>
                        <NavLink
                            to={homePath}
                            className={linkClass}
                            onClick={close}
                            end
                        >
                            <i className="bi bi-speedometer2" />
                            <span>Dashboard</span>
                        </NavLink>
                    </li>

                    <li>
                        <NavLink to="/cases" className={linkClass} onClick={close}>
                            <i className="bi bi-folder2-open" />
                            <span>Case Register</span>
                        </NavLink>
                    </li>

                    {isIntake && (
                        <li>
                            <NavLink to="/cases/search" className={linkClass} onClick={close}>
                                <i className="bi bi-search" />
                                <span>Smart Search</span>
                            </NavLink>
                        </li>
                    )}

                    {(isInvestigator || isCommander || isAdmin) && (
                        <li>
                            <NavLink to="/evidence" className={linkClass} onClick={close}>
                                <i className="bi bi-box-seam" />
                                <span>Evidence Ledger</span>
                            </NavLink>
                        </li>
                    )}

                    {(isCommander || isAdmin || isInvestigator || isIntake) && (
                        <>
                            <li className="sidebar-heading mt-3">Analytics &amp; Reports</li>

                            {(isCommander || isAdmin) && (
                                <li>
                                    <NavLink to="/supervisor/analytics" className={linkClass} onClick={close}>
                                        <i className="bi bi-graph-up-arrow" />
                                        <span>Analytics &amp; Hotspots</span>
                                    </NavLink>
                                </li>
                            )}

                            {(isInvestigator || isIntake) && (
                                <li>
                                    <NavLink to="/my-analytics" className={linkClass} onClick={close}>
                                        <i className="bi bi-graph-up-arrow" />
                                        <span>My Analytics</span>
                                    </NavLink>
                                </li>
                            )}

                            {isInvestigator && (
                                <li>
                                    <a href="/reports/my-cases" className="sidebar-link">
                                        <i className="bi bi-file-earmark-person" />
                                        <span>My Case Report</span>
                                    </a>
                                </li>
                            )}

                            {(isCommander || isAdmin) && (
                                <>
                                    <li>
                                        <a href="/supervisor/reports/station-performance" className="sidebar-link">
                                            <i className="bi bi-file-earmark-bar-graph" />
                                            <span>Station Performance PDF</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/supervisor/reports/crime-statistics" className="sidebar-link">
                                            <i className="bi bi-file-earmark-text" />
                                            <span>Crime Statistics PDF</span>
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/supervisor/reports/officer-productivity" className="sidebar-link">
                                            <i className="bi bi-file-earmark-person" />
                                            <span>Officer Productivity PDF</span>
                                        </a>
                                    </li>
                                </>
                            )}
                        </>
                    )}

                    {isAdmin && (
                        <>
                            <li className="sidebar-heading mt-3">Administration</li>
                            <li>
                                <NavLink to="/admin/dashboard" className={linkClass} onClick={close}>
                                    <i className="bi bi-shield-lock" />
                                    <span>Admin Overview</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/admin/users" className={linkClass} onClick={close}>
                                    <i className="bi bi-people" />
                                    <span>Personnel Accounts</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/admin/audit-logs" className={linkClass} onClick={close}>
                                    <i className="bi bi-journal-text" />
                                    <span>Security Audit Logs</span>
                                </NavLink>
                            </li>
                        </>
                    )}

                    <li className="sidebar-heading mt-3">Account</li>

                    <li>
                        <NavLink to="/change-password" className={linkClass} onClick={close}>
                            <i className="bi bi-key-fill text-warning" />
                            <span>Change Password</span>
                        </NavLink>
                    </li>

                    <li>
                        <button type="button" className="sidebar-link text-danger border-0 bg-transparent w-100 text-start" onClick={handleLogout}>
                            <i className="bi bi-box-arrow-right" />
                            <span>Sign Out</span>
                        </button>
                    </li>
                </ul>

                <div className="sidebar-footer">
                    {user && (
                        <div className="d-flex align-items-center mb-2">
                            <div
                                className="bg-secondary rounded-circle d-flex align-items-center justify-content-center text-white fw-bold me-2"
                                style={{ width: 32, height: 32, fontSize: '0.8rem' }}
                            >
                                {initials(user)}
                            </div>
                            <div className="overflow-hidden">
                                <div className="text-white text-truncate fw-semibold" style={{ fontSize: '0.825rem' }}>
                                    {user.first_name ? `${user.first_name} ${user.last_name}` : 'Officer'}
                                </div>
                                <div className="text-warning text-truncate" style={{ fontSize: '0.7rem' }}>{user.role}</div>
                            </div>
                        </div>
                    )}
                    <div className="text-white-50 pt-2 border-top border-secondary border-opacity-25" style={{ fontSize: '0.68rem' }}>
                        Malawi Police Service — Limbe Station
                    </div>
                </div>
            </aside>
        </>
    );
}
