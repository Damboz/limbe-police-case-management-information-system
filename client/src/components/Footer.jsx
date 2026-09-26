export default function Footer() {
    return (
        <footer className="system-footer mt-auto py-3 px-4 bg-white border-top">
            <div
                className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2 text-muted"
                style={{ fontSize: '0.8125rem' }}
            >
                <div className="d-flex align-items-center gap-2">
                    <span className="fw-semibold text-dark">
                        &copy; {new Date().getFullYear()} Malawi Police Service
                    </span>
                    <span className="text-muted">•</span>
                    <span>Limbe Station Case Management System</span>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <span
                        className="badge border border-warning text-warning-emphasis bg-warning bg-opacity-10 font-monospace"
                        style={{ fontSize: '0.6875rem', letterSpacing: '0.05em' }}
                    >
                        <i className="bi bi-shield-lock-fill me-1" />RESTRICTED — OFFICIAL USE ONLY
                    </span>
                    <span className="text-muted font-monospace d-none d-lg-inline" style={{ fontSize: '0.725rem' }}>
                        v1.0.0
                    </span>
                </div>
            </div>
        </footer>
    );
}
