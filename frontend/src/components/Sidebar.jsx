import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleFlags } from '../lib/roles';
import { initials } from '../lib/format';


function linkClass({ isActive }) {
    return `sidebar-link${isActive ? ' active' : ''}`;
}


function matchesPath(to, pathname, end) {
    if (!to) return false;
    const base = to.replace(/\/+$/, '');
    if (end) return pathname === base;
    return pathname === base || pathname.startsWith(`${base}/`);
}


function SidebarSection({ id, title, open, isCurrent, onToggle, children }) {
    return (
        <li className={`sidebar-section${open ? ' open' : ''}${isCurrent ? ' current' : ''}`}>
            <button
                type="button"
                className="sidebar-section-toggle"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={`sidebar-section-${id}`}
            >
                <span>{title}</span>
                <i className="bi bi-chevron-down sidebar-section-chevron" aria-hidden="true" />
            </button>
            <div id={`sidebar-section-${id}`} className="sidebar-section-body" role="group" aria-label={title}>
                <ul>{children}</ul>
            </div>
        </li>
    );
}


export default function Sidebar({ open = false, onClose = () => {}, onDownloadReport = () => {} }) {
    const { user, logout, homePath } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { isInvestigator, isCommander, isAdmin, isIntake } = roleFlags(user);

    const sections = useMemo(() => {
        const commanderReports = isCommander && !isAdmin;

        return [
            {
                id: 'core',
                title: 'Core Operations',
                links: [
                    { to: homePath, icon: 'bi-speedometer2', label: 'Dashboard', end: true },
                    !isAdmin && { to: '/cases', icon: 'bi-folder2-open', label: 'Case Register' },
                    isIntake && !isAdmin && { to: '/cases/search', icon: 'bi-search', label: 'Smart Search' },
                    (isInvestigator || commanderReports) && { to: '/evidence', icon: 'bi-box-seam', label: 'Evidence Ledger' }
                ].filter(Boolean)
            },
            {
                id: 'analytics',
                title: 'Analytics & Reports',
                links: [
                    commanderReports && { to: '/supervisor/analytics', icon: 'bi-graph-up-arrow', label: 'Analytics & Hotspots' },
                    (isInvestigator || isIntake) && { to: '/my-analytics', icon: 'bi-graph-up-arrow', label: 'My Analytics' },
                    isInvestigator && { report: 'myCases', icon: 'bi-file-earmark-person', label: 'My Case Report' },
                    commanderReports && { report: 'stationPerformance', icon: 'bi-file-earmark-bar-graph', label: 'Station Performance PDF' },
                    commanderReports && { report: 'crimeStatistics', icon: 'bi-file-earmark-text', label: 'Crime Statistics PDF' },
                    commanderReports && { report: 'officerProductivity', icon: 'bi-file-earmark-person', label: 'Officer Productivity PDF' }
                ].filter(Boolean)
            },
            {
                id: 'admin',
                title: 'Administration',
                links: isAdmin ? [
                    { to: '/admin/dashboard', icon: 'bi-shield-lock', label: 'Admin Overview' },
                    { to: '/admin/users', icon: 'bi-people', label: 'Personnel Accounts' },
                    { to: '/admin/audit-logs', icon: 'bi-journal-text', label: 'Security Audit Logs' }
                ] : []
            },
            {
                id: 'account',
                title: 'Account',
                links: [
                    { to: '/change-password', icon: 'bi-key-fill text-warning', label: 'Change Password' }
                ]
            }
        ].filter(section => section.links.length > 0);
    }, [homePath, isInvestigator, isCommander, isAdmin, isIntake]);

    const currentSectionId = useMemo(() => {
        const match = sections.find(section => section.links.some(link => matchesPath(link.to, pathname, link.end)));
        return match ? match.id : null;
    }, [sections, pathname]);

    const [openSections, setOpenSections] = useState(() => {
        const first = sections.find(section => section.links.some(link => matchesPath(link.to, pathname, link.end))) || sections[0];
        return new Set(first ? [first.id] : []);
    });

    useEffect(() => {
        if (!currentSectionId) return;
        setOpenSections(prev => (prev.has(currentSectionId) ? prev : new Set([...prev, currentSectionId])));
    }, [currentSectionId]);

    const close = () => onClose();

    const toggleSection = (id) => {
        setOpenSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

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
                    {sections.map(section => (
                        <SidebarSection
                            key={section.id}
                            id={section.id}
                            title={section.title}
                            open={openSections.has(section.id)}
                            isCurrent={currentSectionId === section.id}
                            onToggle={() => toggleSection(section.id)}
                        >
                            {section.links.map(link => (
                                <li key={link.label}>
                                    {link.report ? (
                                        <button type="button" className="sidebar-link w-100 border-0 bg-transparent text-start" onClick={() => { close(); onDownloadReport(link.report); }}>
                                            <i className={`bi ${link.icon}`} />
                                            <span>{link.label}</span>
                                        </button>
                                    ) : (
                                        <NavLink to={link.to} className={linkClass} onClick={close} end={link.end}>
                                            <i className={`bi ${link.icon}`} />
                                            <span>{link.label}</span>
                                        </NavLink>
                                    )}
                                </li>
                            ))}

                            {section.id === 'account' && (
                                <li>
                                    <button type="button" className="sidebar-link text-danger border-0 bg-transparent w-100 text-start" onClick={handleLogout}>
                                        <i className="bi bi-box-arrow-right" />
                                        <span>Sign Out</span>
                                    </button>
                                </li>
                            )}
                        </SidebarSection>
                    ))}
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
