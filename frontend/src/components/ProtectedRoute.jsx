import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Forbidden from '../pages/Forbidden';
import { Spinner } from './ui';
import { canonicalRole, canonicalRoleId, ROLES, ROLE_IDS, ROLE_IDS_BY_NAME } from '../lib/roles';


const ADMIN_MESSAGE = 'Access Denied. System Administrator permissions required.';
const ROLE_MESSAGE = 'Access Denied. You do not have permission to view this resource.';


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
            return <Forbidden message={ADMIN_MESSAGE} />;
        }
    }

    if (roles && roles.length > 0) {
        const role = canonicalRole(user);
        const roleId = canonicalRoleId(user);
        const roleMatches = Boolean(role) && roles.includes(role);
        const idMatches = roleId !== null && roles.some(r => ROLE_IDS_BY_NAME[r] === roleId);

        if (!roleMatches && !idMatches) {
            return <Forbidden message={ROLE_MESSAGE} />;
        }
    }

    return children;
}
