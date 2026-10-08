import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


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


function Modal({ title, onClose, children, footer }) {
    return (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ background: 'rgba(15,23,42,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow">
                    <div className="modal-header bg-navy text-white">
                        <h5 className="modal-title fw-bold">{title}</h5>
                        <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose} />
                    </div>
                    {children}
                    {footer && <div className="modal-footer" style={{ backgroundColor: 'var(--mps-bg-subtle)' }}>{footer}</div>}
                </div>
            </div>
        </div>
    );
}


export default function BranchDashboard() {
    const toast = useToast();
    const { data, error, loading, reload } = useApiData(api.branchDashboard);
    usePageTitle('Branch In-charge Dashboard');

    const [reviewTarget, setReviewTarget] = useState(null);
    const [reviewDecision, setReviewDecision] = useState('Recommend');
    const [reviewComment, setReviewComment] = useState('');

    const [reassignTarget, setReassignTarget] = useState(null);
    const [reassignForm, setReassignForm] = useState({ case_id: '', current_investigator_id: '', proposed_investigator_id: '', reason: '' });

    const [reportModal, setReportModal] = useState(null);
    const [reportForm, setReportForm] = useState({ report_type: 'Social Welfare Report', notes: '' });

    const [actionError, setActionError] = useState(null);
    const [busy, setBusy] = useState(false);

    const investigators = data?.investigators || [];
    const byId = useMemo(() => {
        const map = {};
        investigators.forEach(inv => { map[String(inv.id)] = inv; });
        return map;
    }, [investigators]);

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const { kpi, pendingReviews, returnedCases, branchActiveCases, delayedExternalReports } = data;

    const openReassign = (item) => {
        setReassignTarget(item);
        setReassignForm({ case_id: String(item.id), current_investigator_id: '', proposed_investigator_id: '', reason: '' });
        setActionError(null);
    };

    const openReport = (item) => {
        setReportModal(item);
        setReportForm({ report_type: 'Social Welfare Report', notes: '' });
        setActionError(null);
    };

    const submitReview = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.reviewCase(reviewTarget.id, { decision: reviewDecision, comment: reviewComment });
            toast.success(res.message || 'Review recorded.');
            setReviewTarget(null);
            setReviewComment('');
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const submitReassignment = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.proposeReassignment(reassignTarget.id, {
                current_investigator_id: reassignForm.current_investigator_id,
                proposed_investigator_id: reassignForm.proposed_investigator_id,
                reason: reassignForm.reason
            });
            toast.success(res.message || 'Reassignment proposal submitted.');
            setReassignTarget(null);
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const submitExternalReport = async (e) => {
        e.preventDefault();
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.requestExternalReport(reportModal.id, { report_type: reportForm.report_type, notes: reportForm.notes });
            toast.success(res.message || 'External report request recorded.');
            setReportModal(null);
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const markReceived = async (reportId) => {
        setBusy(true);
        setActionError(null);
        try {
            const res = await api.markReportReceived(reportId, {});
            toast.success(res.message || 'Report marked as received.');
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
                title="Branch In-charge Dashboard"
                subtitle="Review completion requests, monitor your branch, and follow up on external reports."
                actions={
                    <>
                        <Link to="/cases" className="btn btn-outline-navy btn-sm">
                            <i className="bi bi-folder2-open me-1" />Case Register
                        </Link>
                    </>
                }
            />

            <Alert variant="danger" message={actionError} onDismiss={() => setActionError(null)} />

            <div className="row g-3 mb-4">
                <Metric label="Awaiting Your Review" value={kpi.pendingReviews} icon="bi-clipboard-check-fill" tone="navy" color="var(--mps-info)" />
                <Metric label="Returned to Investigators" value={kpi.returned} icon="bi-arrow-counterclockwise" tone="warning" color="var(--mps-warning)" />
                <Metric label="Branch Active Investigations" value={kpi.activeCases} icon="bi-search" tone="success" color="var(--mps-success)" />
                <Metric label="Outstanding External Reports" value={kpi.delayedExternal} icon="bi-clock-history" tone="danger" color="var(--mps-danger)" />
            </div>

            <div className="row g-4 mb-4">
                <div className="col-lg-7">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-pencil-square me-2 text-warning" />Completion Requests Awaiting Review
                            </h6>
                            <span className="badge bg-gold text-dark">{pendingReviews.length} Pending</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case Ref</th>
                                        <th>Title &amp; Category</th>
                                        <th>Requested</th>
                                        <th>Investigator(s)</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingReviews.length === 0 ? (
                                        <tr><td colSpan="5"><EmptyState icon="bi-clipboard-check" message="No case completion requests awaiting your review." /></td></tr>
                                    ) : (
                                        pendingReviews.map(item => (
                                            <tr key={item.id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td>
                                                    <div className="small fw-semibold">
                                                        {item.requested_status === 'Forwarded to Prosecution' ? 'Prosecution' : item.requested_status === 'Closed' ? 'Closure' : 'Court Pending'}
                                                    </div>
                                                    <small className="text-muted d-block">{formatDate(item.status_requested_at)}</small>
                                                </td>
                                                <td><small className="fw-semibold">{item.investigator_names || '—'}</small></td>
                                                <td className="text-end">
                                                    <button type="button" className="btn btn-sm btn-navy" onClick={() => { setReviewTarget(item); setReviewDecision('Recommend'); setReviewComment(''); setActionError(null); }}>
                                                        <i className="bi bi-pencil-fill me-1" />Review
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
                                <i className="bi bi-clock-history me-2 text-warning" />Outstanding External Reports
                            </h6>
                            <span className="badge bg-gold text-dark">{delayedExternalReports.length} Pending</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case</th>
                                        <th>Report Type</th>
                                        <th>Days Open</th>
                                        <th className="text-end">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {delayedExternalReports.length === 0 ? (
                                        <tr><td colSpan="4"><EmptyState icon="bi-check-circle-fill" message="No outstanding external report requests." /></td></tr>
                                    ) : (
                                        delayedExternalReports.map(item => (
                                            <tr key={item.id}>
                                                <td>
                                                    <div className="fw-bold" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</div>
                                                    <small className="text-muted d-block text-truncate">{item.crime_category}</small>
                                                </td>
                                                <td><small className="fw-semibold">{item.report_type}</small></td>
                                                <td>
                                                    <span className="badge badge-priority-critical">{item.days_outstanding} days</span>
                                                </td>
                                                <td className="text-end">
                                                    <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => markReceived(item.id)}>
                                                        <i className="bi bi-check-lg me-1" />Mark Received
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

            <div className="row g-4 mb-4">
                <div className="col-12">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                            <h6 className="mb-0 fw-bold">
                                <i className="bi bi-folder2-open me-2 text-warning" />Branch Active Cases
                            </h6>
                            <span className="badge bg-gold text-dark">{branchActiveCases.length} Shown</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Case Ref</th>
                                        <th>Title &amp; Category</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th>Investigators</th>
                                        <th>Days Open</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branchActiveCases.length === 0 ? (
                                        <tr><td colSpan="7"><EmptyState message="No active cases in this branch at the moment." /></td></tr>
                                    ) : (
                                        branchActiveCases.map(item => (
                                            <tr key={item.id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td><PriorityBadge priority={item.priority} /></td>
                                                <td><StatusBadge status={item.status} /></td>
                                                <td><small className="fw-semibold">{item.investigator_names || 'Unassigned'}</small></td>
                                                <td className="small text-muted">{item.days_open} days</td>
                                                <td className="text-end text-nowrap">
                                                    <Link to={`/cases/${item.id}`} className="btn btn-sm btn-outline-navy me-1">
                                                        <i className="bi bi-folder2-open" />
                                                    </Link>
                                                    <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => openReassign(item)}>
                                                        <i className="bi bi-arrow-repeat me-1" />Reassign
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

            {returnedCases.length > 0 && (
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-navy text-white py-3">
                                <h6 className="mb-0 fw-bold">
                                    <i className="bi bi-arrow-counterclockwise me-2 text-warning" />Recently Returned to Investigators
                                </h6>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th>Case Ref</th>
                                            <th>Title &amp; Category</th>
                                            <th>Priority</th>
                                            <th>Returned</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returnedCases.map(item => (
                                            <tr key={item.id}>
                                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.case_number}</td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{item.title}</div>
                                                    <small className="text-muted">{item.crime_category}</small>
                                                </td>
                                                <td><PriorityBadge priority={item.priority} /></td>
                                                <td className="small text-muted">{formatDate(item.updated_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {reviewTarget && (
                <Modal
                    title="Review Case Completion Request"
                    onClose={() => setReviewTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setReviewTarget(null)}>Cancel</button>
                            <button type="submit" form="review-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-check-lg me-1" />Submit Minute
                            </button>
                        </>
                    }
                >
                    <form id="review-form" onSubmit={submitReview}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{reviewTarget.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">REQUESTED TRANSITION</label>
                                <div className="form-control-plaintext fw-bold text-dark">
                                    {reviewTarget.requested_status === 'Forwarded to Prosecution'
                                        ? 'Forward to Prosecution (PROSECUTION BRANCH)'
                                        : reviewTarget.requested_status === 'Closed' ? 'Close Case (CLOSED)' : 'Transfer to Court (COURT PENDING)'}
                                </div>
                            </div>
                            {reviewTarget.status_request_notes && (
                                <div className="mb-3">
                                    <label className="form-label">INVESTIGATOR JUSTIFICATION</label>
                                    <div className="form-control-plaintext small text-dark">{reviewTarget.status_request_notes}</div>
                                </div>
                            )}
                            <div className="mb-3">
                                <label htmlFor="review_decision" className="form-label">Branch Review Decision <span className="text-danger">*</span></label>
                                <select id="review_decision" className="form-select" value={reviewDecision} onChange={e => setReviewDecision(e.target.value)} required>
                                    <option value="Recommend">Recommend to Station Officer</option>
                                    <option value="Return">Return for Further Investigation</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="review_comment" className="form-label">Branch Minute <span className="text-danger">*</span></label>
                                <textarea
                                    id="review_comment"
                                    rows="3"
                                    className="form-control"
                                    placeholder="Record your substantive recommendation as the Branch In-charge..."
                                    value={reviewComment}
                                    onChange={e => setReviewComment(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}

            {reassignTarget && (
                <Modal
                    title="Propose Case Reassignment"
                    onClose={() => setReassignTarget(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setReassignTarget(null)}>Cancel</button>
                            <button type="submit" form="reassign-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-send-fill me-1" />Submit Proposal
                            </button>
                        </>
                    }
                >
                    <form id="reassign-form" onSubmit={submitReassignment}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{reassignTarget.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="current_investigator" className="form-label">Current Investigator (Optional)</label>
                                <select
                                    id="current_investigator"
                                    className="form-select"
                                    value={reassignForm.current_investigator_id}
                                    onChange={e => setReassignForm(prev => ({ ...prev, current_investigator_id: e.target.value }))}
                                >
                                    <option value="">— Select current investigator —</option>
                                    {investigators.map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.rank_title} {inv.first_name} {inv.last_name} ({inv.badge_number})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="proposed_investigator" className="form-label">Proposed Investigator <span className="text-danger">*</span></label>
                                <select
                                    id="proposed_investigator"
                                    className="form-select"
                                    value={reassignForm.proposed_investigator_id}
                                    onChange={e => setReassignForm(prev => ({ ...prev, proposed_investigator_id: e.target.value }))}
                                    required
                                >
                                    <option value="">— Select proposed investigator —</option>
                                    {investigators.map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.rank_title} {inv.first_name} {inv.last_name} ({inv.badge_number}) — Active Load: {inv.active_case_count}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="reassign_reason" className="form-label">Reason for Reassignment <span className="text-danger">*</span></label>
                                <textarea
                                    id="reassign_reason"
                                    rows="3"
                                    className="form-control"
                                    placeholder="Explain why the case should move to another investigator..."
                                    value={reassignForm.reason}
                                    onChange={e => setReassignForm(prev => ({ ...prev, reason: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}

            {reportModal && (
                <Modal
                    title="Request External Report"
                    onClose={() => setReportModal(null)}
                    footer={
                        <>
                            <button type="button" className="btn btn-outline-navy" onClick={() => setReportModal(null)}>Cancel</button>
                            <button type="submit" form="report-form" className="btn btn-navy" disabled={busy}>
                                <i className="bi bi-send-fill me-1" />Request Report
                            </button>
                        </>
                    }
                >
                    <form id="report-form" onSubmit={submitExternalReport}>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label">CASE REFERENCE</label>
                                <div className="form-control-plaintext fw-bold">#{reportModal.case_number}</div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="report_type" className="form-label">Report Type <span className="text-danger">*</span></label>
                                <select
                                    id="report_type"
                                    className="form-select"
                                    value={reportForm.report_type}
                                    onChange={e => setReportForm(prev => ({ ...prev, report_type: e.target.value }))}
                                    required
                                >
                                    <option value="Social Welfare Report">Social Welfare Report</option>
                                    <option value="Medical Report">Medical Report</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="report_notes" className="form-label">Notes to Requesting Office</label>
                                <textarea
                                    id="report_notes"
                                    rows="3"
                                    className="form-control"
                                    placeholder="What should the external office focus on..."
                                    value={reportForm.notes}
                                    onChange={e => setReportForm(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}