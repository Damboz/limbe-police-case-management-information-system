import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Forbidden from '../pages/Forbidden';
import { Spinner } from './ui';
import { canonicalRole, canonicalRoleId, homePathFor, ROLES, ROLE_IDS, ROLE_IDS_BY_NAME } from '../lib/roles';


// A signed-in officer who opens a section their role does not own is sent home to
// their own dashboard instead of being stranded on the 403 page. The Forbidden page
// is only rendered if the dashboard itself is unreachable, which would otherwise
// turn the redirect into a loop.
function denialFallback(user, pathname) {
    const home = homePathFor(user);
    if (home && home !== pathname) {
        return <Navigate to={home} replace />;
    }
    return <Forbidden />;
}


export default function ProtectedRoute({ children, roles, adminOnly = false }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
                <Spinner label="Verifying session…" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname, reason: 'Please log in to access this page.' }} />;
    }

    if (adminOnly) {
        const role = canonicalRole(user);
        const roleId = canonicalRoleId(user);
        if (role !== ROLES.ADMIN && roleId !== ROLE_IDS.ADMIN) {
            return denialFallback(user, location.pathname);
        }
    }

    if (roles && roles.length > 0) {
        const role = canonicalRole(user);
        const roleId = canonicalRoleId(user);
        const roleMatches = Boolean(role) && roles.includes(role);
        const idMatches = roleId !== null && roles.some(r => ROLE_IDS_BY_NAME[r] === roleId);

        if (!roleMatches && !idMatches) {
            return denialFallback(user, location.pathname);
        }
    }

    return children;
}
