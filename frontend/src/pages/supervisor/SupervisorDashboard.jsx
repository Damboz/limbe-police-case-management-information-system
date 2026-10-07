import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';
import useReportExport from '../../hooks/useReportExport';


function Metric({ label, value, icon, tone, color }) {
    return (
        <div className="col-12 col-sm-6 col-xl-3">
            <div className="card border-0 shadow-sm p-3">
                <div className="metric-card">
                    <div>
                        <span className="text-muted small fw-semibold text-uppercase d-block mb-1">{label}</span>
                        <h3 className="fw-bold mb-0" style={{ color }}>{value}</h3>
                    </div>
                    <div className={`metric-icon ${tone}`}><i className={`bi ${icon}`} /></div>
                </div>
            </div>
        </div>
    );
}


function ExportMenu({ label, icon, items, onSelectReport }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        const onPointerDown = (event) => {
            if (ref.current && !ref.current.contains(event.target)) setOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div className="btn-group position-relative" ref={ref}>
            <button
                type="button"
                className="btn btn-navy btn-sm dropdown-toggle"
                aria-expanded={open}
                onClick={() => setOpen(v => !v)}
            >
                <i className={`bi ${icon} me-1`} />{label}
            </button>
            {open && (
                <ul className="dropdown-menu dropdown-menu-end show shadow-sm">
                    {items.map(item => (
                        <li key={item.report}>
                            <button
                                type="button"
                                className="dropdown-item small"
                                onClick={() => {
                                    setOpen(false);
                                    onSelectReport(item.report);
                                }}
                            >
                                <i className={`bi ${item.icon} me-2`} />{item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}


function Modal({ title, headerClass = 'bg-navy text-white', onClose, children, footer }) {
    return (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ background: 'rgba(15,23,42,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow">
                    <div className={`modal-header ${headerClass}`}>
                        <h5 className="modal-title fw-bold">{title}</h5>
                        <button type="button" className={`btn-close ${headerClass.includes('text-white') ? 'btn-close-white' : ''}`} aria-label="Close" onClick={onClose} />
                    </div>
                    {children}
                    {footer && <div className="modal-footer" style={{ backgroundColor: 'var(--mps-bg-subtle)' }}>{footer}</div>}
                </div>
            </div>
        </div>
    );
}


export default function SupervisorDashboard() {
    const toast = useToast();
    const { data, error, loading, reload } = useApiData(api.supervisorDashboard);
    usePageTitle('Supervisor Command Dashboard');

    const [assignTarget, setAssignTarget] = useState(null);
    const [assignMode, setAssignMode] = useState('assign');
    const [selectedInvestigators, setSelectedInvestigators] = useState([]);
    const [assignNotes, setAssignNotes] = useState('');

    const [approvalTarget, setApprovalTarget] = useState(null);
    const [decision, setDecision] = useState('APPROVE');
    const [supervisorNotes, setSupervisorNotes] = useState('');

    const [actionError, setActionError] = useState(null);
    const [busy, setBusy] = useState(false);

    const { requestReport, modal: reportPeriodModal } = useReportExport('Export Report');

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const { kpi, overdueDaysThreshold, unassignedCases, pendingApprovals, investigatorWorkload, assignedActiveCases } = data;

    const openAssign = (item, mode) => {
        setAssignTarget(item);
        setAssignMode(mode);
        setSelectedInvestigators(
            mode === 'manage'
                ? String(item.investigator_ids || '').split(',').map(s => s.trim()).filter(Boolean)
                : []
        );
        setAssignNotes('');
        setActionError(null);
    };

    const submitAssign = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.assignCase({
                case_id: assignTarget.id,
                investigator_ids: selectedInvestigators,
                notes: assignNotes
            });
            toast.success(res.message || 'Case assignments updated.');
            setAssignTarget(null);
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const submitApproval = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.approveStatus({
                case_id: approvalTarget.id,
                decision,
                supervisor_notes: supervisorNotes
            });
            toast.success(res.message || 'Decision recorded.');
            setApprovalTarget(null);
            setSupervisorNotes('');
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <PageHeader
                title="Supervisor Command Dashboard"
                subtitle="Station operational oversight, case distribution, and status approvals."
                actions={
                    <>
                        <Link to="/supervisor/analytics" className="btn btn-outline-navy btn-sm">
                            <i className="bi bi-graph-up-arrow me-1" />Analytics &amp; Hotspots
                        </Link>
                        <ExportMenu
                            label="Export Reports"
                            icon="bi-file-earmark-pdf-fill"
                            items={[
                                { report: 'stationPerformance', label: 'Station Performance', icon: 'bi-bar-chart-line' },
                                { report: 'crimeStatistics', label: 'Crime Statistics', icon: 'bi-graph-up' },
                                { report: 'officerProductivity', label: 'Officer Productivity', icon: 'bi-person-lines-fill' }
                            ]}
                            onSelectReport={requestReport}
                        />
                    </>
                }
            />

            <Alert variant="danger" message={actionError} onDismiss={() => setActionError(null)} />

            <div className="row g-3 mb-4">
                <Metric label="Unassigned Cases" value={kpi.unassigned} icon="bi-folder2-open" tone="warning" color="var(--mps-warning)" />
                <Metric label="Pending Approvals" value={kpi.pendingApprovals} icon="bi-clipboard-check-fill" tone="navy" color="var(--mps-info)" />
                <Metric label="Active Investigations" value={kpi.activeCases} icon="bi-search" tone="success" color="var(--mps-success)" />
                <Metric label={`Overdue (${overdueDaysThreshold}+ days)`} value={kpi.overdue} icon="bi-alarm-fill" tone="danger" color="var(--mps-danger)" />
            </div>

            <div className="row g-4 mb-4">
                <div className="col-lg-7">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-exclamation-triangle-fill me-2 text-warning" />Unassigned Case Queue
                            </h6>
                            <span className="badge bg-gold text-dark">{unassignedCases.length} Pending</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case Ref</th>
                                        <th>Title &amp; Category</th>
                                        <th>Priority</th>
                                        <th>Reg. Date</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unassignedCases.length === 0 ? (
                                        <tr>
                                            <td colSpan="5">
                                                <EmptyState
                                                    icon="bi-check-circle-fill"
                                                    message="All registered cases have been assigned!"
                                                />
                                            </td>
                                        </tr>
                                    ) : (
                                        unassignedCases.map(item => (
                                            <tr key={item.id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td><PriorityBadge priority={item.priority} /></td>
                                                <td className="small text-muted">{formatDate(item.created_at)}</td>
                                                <td className="text-end">
                                                    <button type="button" className="btn btn-sm btn-navy" onClick={() => openAssign(item, 'assign')}>
                                                        <i className="bi bi-person-plus-fill me-1" />Assign
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="col-lg-5">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-list-task me-2 text-warning" />Pending Approvals
                            </h6>
                            <span className="badge bg-gold text-dark">{pendingApprovals.length} Action Needed</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case</th>
                                        <th>Requested Target</th>
                                        <th>Investigator</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingApprovals.length === 0 ? (
                                        <tr>
                                            <td colSpan="4">
                                                <EmptyState icon="bi-clipboard-check" message="No status change approvals pending review." />
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingApprovals.map(item => (
                                            <tr key={item.id}>
                                                <td>
                                                    <div className="fw-bold" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</div>
                                                    <small className="text-muted d-block text-truncate">{item.title}</small>
                                                </td>
                                                <td>
                                                    {item.requested_status === 'Closed' ? (
                                                        <span className="badge badge-case-closed"><i className="bi bi-lock-fill me-1" />Closure</span>
                                                    ) : (
                                                        <span className="badge badge-case-investigation"><i className="bi bi-bank2 me-1" />Court</span>
                                                    )}
                                                </td>
                                                <td><small className="fw-semibold">{item.investigator_name}</small></td>
                                                <td className="text-end">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-navy"
                                                        onClick={() => { setApprovalTarget(item); setDecision('APPROVE'); setSupervisorNotes(''); setActionError(null); }}
                                                    >
                                                        Review
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row mb-4">
                <div className="col-12">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-arrow-left-right me-2 text-warning" />Active Assigned Cases
                            </h6>
                            <span className="badge bg-gold text-dark">{assignedActiveCases.length} Active</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case Ref</th>
                                        <th>Title &amp; Category</th>
                                        <th>Priority</th>
                                        <th>Assigned Investigator</th>
                                        <th>Days Open</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignedActiveCases.length === 0 ? (
                                        <tr><td colSpan="6"><EmptyState message="No active assigned cases at this time." /></td></tr>
                                    ) : (
                                        assignedActiveCases.map(item => (
                                            <tr key={item.id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td><PriorityBadge priority={item.priority} /></td>
                                                <td className="small">{item.investigator_names || 'Unassigned'}</td>
                                                <td>
                                                    {item.status === 'Under Investigation' && item.days_open > overdueDaysThreshold ? (
                                                        <span className="badge badge-priority-critical">
                                                            <i className="bi bi-alarm-fill me-1" />{item.days_open} days
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted small">{item.days_open} days</span>
                                                    )}
                                                </td>
                                                <td className="text-end">
                                                    <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => openAssign(item, 'manage')}>
                                                        <i className="bi bi-people-fill me-1" />Manage
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-12">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-people-fill me-2 text-warning" />Investigator Active Workload Summary
                            </h6>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Badge Number</th>
                                        <th>Officer Name</th>
                                        <th>Rank</th>
                                        <th>Active Load</th>
                                        <th>Capacity Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {investigatorWorkload.length === 0 ? (
                                        <tr><td colSpan="5"><EmptyState message="No active investigators found." /></td></tr>
                                    ) : (
                                        investigatorWorkload.map(officer => (
                                            <tr key={officer.id}>
                                                <td className="fw-bold font-monospace small">{officer.badge_number}</td>
                                                <td>{officer.first_name} {officer.last_name}</td>
                                                <td><span className="badge bg-light text-dark border">{officer.rank_title}</span></td>
                                                <td><span className="fw-bold">{officer.active_case_count}</span> Active Cases</td>
                                                <td>
                                                    {officer.active_case_count === 0 ? (
                                                        <span className="badge badge-case-closed">Available</span>
                                                    ) : officer.active_case_count <= 4 ? (
                                                        <span className="badge badge-case-open">Optimal Load</span>
                                                    ) : (
                                                        <span className="badge badge-priority-critical">Heavy Workload</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {assignTarget && (
                <Modal
                    title={assignMode === 'manage' ? 'Manage Investigators for Case' : 'Assign Case to Investigator(s)'}
                    onClose={() => setAssignTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setAssignTarget(null)}>Cancel</button>
                            <button type="submit" form="assign-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-check-lg me-1" />
                                {assignMode === 'manage' ? 'Update Assignments' : 'Confirm Assignment'}
                            </button>
                        </>
                    }
                >
                    <form id="assign-form" onSubmit={submitAssign}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{assignTarget.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">CASE TITLE</label>
                                <div className="form-control-plaintext text-dark">{assignTarget.title}</div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Select Active Investigator(s) <span className="text-danger">*</span></label>
                                <div className="border rounded p-2 bg-light" style={{ maxHeight: 230, overflowY: 'auto' }}>
                                    {investigatorWorkload.map(inv => (
                                        <div className="form-check" key={inv.id}>
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id={`investigator_${inv.id}`}
                                                checked={selectedInvestigators.includes(String(inv.id))}
                                                onChange={(e) => setSelectedInvestigators(prev => (
                                                    e.target.checked
                                                        ? [...prev, String(inv.id)]
                                                        : prev.filter(x => x !== String(inv.id))
                                                ))}
                                            />
                                            <label className="form-check-label" htmlFor={`investigator_${inv.id}`}>
                                                {inv.rank_title} {inv.first_name} {inv.last_name} ({inv.badge_number})
                                                <small className="text-muted">— Active Load: {inv.active_case_count}</small>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                                <div className="form-text">Tick one or more investigators. The first selected is treated as the lead detective.</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="assign_notes" className="form-label">Assignment Instructions / Notes</label>
                                <textarea
                                    id="assign_notes"
                                    rows="3"
                                    className="form-control"
                                    placeholder="Optional directive notes for the investigation team..."
                                    value={assignNotes}
                                    onChange={e => setAssignNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}

            {approvalTarget && (
                <Modal
                    title="Review Status Change Request"
                    onClose={() => setApprovalTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setApprovalTarget(null)}>Cancel</button>
                            <button type="submit" form="approval-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-send-fill me-1" />Submit Decision
                            </button>
                        </>
                    }
                >
                    <form id="approval-form" onSubmit={submitApproval}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{approvalTarget.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">REQUESTED TRANSITION</label>
                                <div className="form-control-plaintext fw-bold text-dark">
                                    {approvalTarget.requested_status === 'Closed' ? 'Close Case (CLOSED)' : 'Transfer to Court (COURT PENDING)'}
                                </div>
                            </div>
                            {approvalTarget.status_request_notes && (
                                <div className="mb-3">
                                    <label className="form-label">INVESTIGATOR JUSTIFICATION</label>
                                    <div className="form-control-plaintext small text-dark">{approvalTarget.status_request_notes}</div>
                                </div>
                            )}
                            <div className="mb-3">
                                <label htmlFor="decision" className="form-label">Supervisor Decision <span className="text-danger">*</span></label>
                                <select id="decision" className="form-select" value={decision} onChange={e => setDecision(e.target.value)} required>
                                    <option value="APPROVE">Approve Request</option>
                                    <option value="REJECT">Reject Request (Return to Investigation)</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="supervisor_notes" className="form-label">Supervisor Review Notes</label>
                                <textarea
                                    id="supervisor_notes"
                                    rows="3"
                                    className="form-control"
                                    placeholder="Provide reasons or directives regarding this decision..."
                                    value={supervisorNotes}
                                    onChange={e => setSupervisorNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}

            {reportPeriodModal}
        </>
    );
}
