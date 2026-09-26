import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../hooks/usePageTitle';


export default function NotFound() {
    const { user, homePath } = useAuth();
    usePageTitle('404 Page Not Found');

    return (
        <div className="card shadow-sm border-0">
            <div className="card-body text-center p-4">
                <i className="bi bi-compass text-muted" style={{ fontSize: '4rem' }} />
                <h3 className="fw-bold mt-3 text-dark">404 — Page Not Found</h3>
                <p className="text-muted mb-4">
                    The page you requested does not exist on this system.
                </p>
                <Link to={user ? homePath : '/login'} className="btn btn-primary fw-bold px-4">
                    <i className="bi bi-arrow-left me-2" />
                    {user ? 'Return to Dashboard' : 'Go to Sign In'}
                </Link>
            </div>
        </div>
    );
}
