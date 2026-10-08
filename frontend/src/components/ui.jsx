export function Alert({ variant = 'danger', message, onDismiss }) {
    if (!message) return null;

    const icons = {
        danger: 'bi-exclamation-octagon-fill',
        success: 'bi-check-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill'
    };

    return (
        <div className={`alert alert-${variant} alert-dismissible fade show small mb-4 border-0 shadow-sm`} role="alert">
            <i className={`bi ${icons[variant] || icons.info} me-2`} />
            {message}
            {onDismiss && (
                <button type="button" className="btn-close" aria-label="Close" onClick={onDismiss} />
            )}
        </div>
    );
}


export function Spinner({ label = 'Loading…' }) {
    return (
        <div className="d-flex align-items-center justify-content-center py-5 text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            <span style={{ fontSize: '0.85rem' }}>{label}</span>
        </div>
    );
}


export function PageHeader({ title, subtitle, actions }) {
    return (
        <div className="page-header">
            <div>
                <h1 className="page-title">{title}</h1>
                {subtitle && <div className="text-muted mt-1" style={{ fontSize: '0.85rem' }}>{subtitle}</div>}
            </div>
            {actions && <div className="d-flex align-items-center gap-2 flex-wrap">{actions}</div>}
        </div>
    );
}


export function StatCard({ label, value, icon, tone = 'navy', hint }) {
    return (
        <div className="card metric-card">
            <div className="card-body">
                <div className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>{label}</div>
                <div className="fs-3 fw-bold text-dark mt-1">{value}</div>
                {hint && <div className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>{hint}</div>}
            </div>
            {icon && (
                <div className={`metric-icon ${tone} me-3`}>
                    <i className={`bi ${icon}`} />
                </div>
            )}
        </div>
    );
}


export function EmptyState({ icon = 'bi-inbox', message, action }) {
    return (
        <div className="text-center py-5 text-muted">
            <i className={`bi ${icon} fs-2 d-block mb-2`} />
            <div style={{ fontSize: '0.875rem' }}>{message}</div>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}


const NEUTRAL_BADGE = 'bg-light text-dark border';

const STATUS_CLASSES = {
    'Closed': 'badge-case-closed',
    'Under Investigation': 'badge-case-investigation',
    'Court Pending': 'badge-case-open',
    'Forwarded to Prosecution': 'badge-case-forwarded',
    'Archived': 'badge-case-archived',
    'Reported': NEUTRAL_BADGE
};

const PRIORITY_BADGES = {
    'Critical': ['badge-priority-critical', 'CRITICAL'],
    'High': ['badge-priority-high', 'HIGH'],
    'Medium': ['badge-priority-medium', 'MEDIUM'],
    'Low': ['badge-priority-low', 'LOW']
};


export function StatusBadge({ status, fallback = 'Reported' }) {
    const key = String(status || '').trim();
    const cls = STATUS_CLASSES[key] || STATUS_CLASSES[fallback] || NEUTRAL_BADGE;

    return <span className={`badge ${cls}`}>{status || '—'}</span>;
}


export function PriorityBadge({ priority }) {
    const [cls, label] = PRIORITY_BADGES[priority] || PRIORITY_BADGES.Low;

    return <span className={`badge ${cls}`}>{label}</span>;
}
