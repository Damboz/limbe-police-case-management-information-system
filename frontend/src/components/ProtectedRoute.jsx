import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Forbidden from '../pages/Forbidden';
import { Spinner } from './ui';


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
        const role = String(user.role || '').toLowerCase();
        if (role !== 'admin' && Number(user.role_id) !== 1) {
            return <Forbidden message={ADMIN_MESSAGE} />;
        }
    }

    if (roles && roles.length > 0) {
        const role = String(user.role || '').toUpperCase();
        const roleIdMap = {
            1: ['ADMIN'],
            2: ['STATION COMMANDER'],
            3: ['INVESTIGATING OFFICER'],
            4: ['COUNTER/INTAKE OFFICER'],
            5: ['BRANCH IN-CHARGE'],
            6: ['PROSECUTOR']
        };
        const allowed = roles.map(r => String(r).toUpperCase());
        const matches = allowed.includes(role)
            || (roleIdMap[Number(user.role_id)] || []).some(alias => allowed.includes(alias));

        if (!matches) {
            return <Forbidden message={ROLE_MESSAGE} />;
        }
    }

    return children;
}
