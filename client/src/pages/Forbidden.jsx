import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../hooks/usePageTitle';


export default function Forbidden({ message }) {
    const { user, homePath } = useAuth();
    usePageTitle('403 Access Denied');

    return (
        <div className="card shadow-sm border-0">
            <div className="card-body text-center p-4">
                <i className="bi bi-shield-slash-fill text-danger" style={{ fontSize: '4rem' }} />
                <h3 className="fw-bold mt-3 text-dark">403 — Access Denied</h3>
                <p className="text-muted mb-4">
                    {message || 'You do not have permission to access this resource.'}
                </p>
                {user ? (
                    <Link to={homePath} className="btn btn-primary fw-bold px-4">
                        <i className="bi bi-arrow-left me-2" />Return to Dashboard
                    </Link>
                ) : (
                    <Link to="/login" className="btn btn-primary fw-bold px-4">
                        <i className="bi bi-box-arrow-in-right me-2" />Go to Sign In
                    </Link>
                )}
            </div>
        </div>
    );
}
