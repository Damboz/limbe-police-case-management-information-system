import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Spinner } from './components/ui';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import MyAnalytics from './pages/MyAnalytics';
import CaseList from './pages/cases/CaseList';
import CaseRegister from './pages/cases/CaseRegister';
import CaseSearch from './pages/cases/CaseSearch';
import CaseDetail from './pages/cases/CaseDetail';
import EvidenceLedger from './pages/evidence/EvidenceLedger';
import AdminDashboard from './pages/admin/AdminDashboard';
import Users from './pages/admin/Users';
import UserCreate from './pages/admin/UserCreate';
import UserEdit from './pages/admin/UserEdit';
import AuditLogs from './pages/admin/AuditLogs';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import SupervisorAnalytics from './pages/supervisor/Analytics';
import HotspotsDetail from './pages/supervisor/HotspotsDetail';
import CategoriesDetail from './pages/supervisor/CategoriesDetail';
import Forbidden from './pages/Forbidden';
import NotFound from './pages/NotFound';


function HomeRedirect() {
    const { user, loading, homePath } = useAuth();

    if (loading) {
        return (
            <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
                <Spinner label="Loading…" />
            </div>
        );
    }
    return <Navigate to={user ? homePath : '/login'} replace />;
}


function LoginRoute() {
    const { user, loading, homePath } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
                <Spinner label="Loading…" />
            </div>
        );
    }
    if (user) {
        return <Navigate to={location.state?.from || homePath} replace />;
    }
    return <Login />;
}


const CMD = ['Station Commander', 'Admin'];
const CFI = ['Investigating Officer', 'Counter/Intake Officer'];
const OPS = ['Investigating Officer', 'Station Commander', 'Admin'];


export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginRoute />} />

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/my-analytics" element={<ProtectedRoute roles={CFI}><MyAnalytics /></ProtectedRoute>} />

                <Route path="/cases" element={<CaseList />} />
                <Route path="/cases/new" element={<CaseRegister />} />
                <Route path="/cases/search" element={<CaseSearch />} />
                <Route path="/cases/:id" element={<CaseDetail />} />

                <Route path="/evidence" element={<ProtectedRoute roles={OPS}><EvidenceLedger /></ProtectedRoute>} />

                <Route path="/admin/dashboard" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
                <Route path="/admin/users/create" element={<ProtectedRoute adminOnly><UserCreate /></ProtectedRoute>} />
                <Route path="/admin/users/:id/edit" element={<ProtectedRoute adminOnly><UserEdit /></ProtectedRoute>} />
                <Route path="/admin/audit-logs" element={<ProtectedRoute adminOnly><AuditLogs /></ProtectedRoute>} />

                <Route path="/supervisor/dashboard" element={<ProtectedRoute roles={CMD}><SupervisorDashboard /></ProtectedRoute>} />
                <Route path="/supervisor/analytics" element={<ProtectedRoute roles={CMD}><SupervisorAnalytics /></ProtectedRoute>} />
                <Route path="/supervisor/analytics/hotspots" element={<ProtectedRoute roles={CMD}><HotspotsDetail /></ProtectedRoute>} />
                <Route path="/supervisor/analytics/categories" element={<ProtectedRoute roles={CMD}><CategoriesDetail /></ProtectedRoute>} />

                <Route path="/403" element={<Forbidden />} />
                <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
