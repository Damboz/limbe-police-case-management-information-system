import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


export default function PendingComplaints() {
    const toast = useToast();
    const { data, error, loading, reload } = useApiData(api.pendingOnlineComplaints);
    usePageTitle('Online Complaints');
    const [busyId, setBusyId] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState('');

    const complaints = data?.complaints || [];

    const approve = async (complaint) => {
        if (!window.confirm(`Approve the complaint from ${complaint.complainant_name}? It will enter the case register.`)) {
            return;
        }
        setBusyId(complaint.id);
        setActionError(null);
        try {
            const res = await api.approveOnlineComplaint(complaint.id);
            toast.success(res.message || 'Complaint approved.');
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const openReject = (complaint) => {
        setRejecting(complaint);
        setReason('');
        setActionError(null);
    };

    const submitReject = async (e) => {
        e.preventDefault();
        if (!rejecting) return;
        if (!reason.trim()) {
            setActionError('Please give a reason for rejecting the complaint.');
            return;
        }
        setBusyId(rejecting.id);
        setActionError(null);
        try {
            const res = await api.rejectOnlineComplaint(rejecting.id, reason.trim());
            toast.success(res.message || 'Complaint rejected.');
            setRejecting(null);
            setReason('');
            reload();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    return (
        <>
            <PageHeader
                title="Online Complaints"
                subtitle="Complaints submitted by the public. Approve one to register it as an official case."
                actions={
                    <Link to="/cases" className="btn btn-outline-navy btn-sm">
                        <i className="bi bi-journal-text me-1" />Case Register
                    </Link>
                }
            />

            <Alert variant="danger" message={actionError} onDismiss={() => setActionError(null)} />

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold">
                        <i className="bi bi-inbox-fill me-2 text-warning" />Awaiting Approval
                    </h6>
                    <span className="badge bg-gold text-dark">{complaints.length} Pending</span>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Reference</th>
                                <th>Complainant</th>
                                <th>Offence</th>
                                <th>Branch</th>
                                <th>Priority</th>
                                <th>Submitted</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {complaints.length === 0 ? (
                                <tr>
                                    <td colSpan="7">
                                        <EmptyState
                                            icon="bi-check2-circle"
                                            message="No complaints are waiting for approval."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                complaints.map(item => (
                                    <tr key={item.id}>
                                        <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>
                                            ONL-{String(item.id).padStart(6, '0')}
                                        </td>
                                        <td>
                                            <div className="fw-semibold small">{item.complainant_name}</div>
                                            <div className="text-muted small">{item.complainant_phone}</div>
                                        </td>
                                        <td className="small">{item.crime_category || '—'}</td>
                                        <td className="small text-muted">{item.branch_name || '—'}</td>
                                        <td><PriorityBadge priority={item.priority} /></td>
                                        <td className="small text-muted">{formatDateTime(item.created_at)}</td>
                                        <td className="text-end">
                                            <div className="d-flex justify-content-end gap-2 flex-wrap">
                                                <Link to={`/cases/${item.id}`} className="btn btn-sm btn-outline-navy">
                                                    <i className="bi bi-eye-fill me-1" />View
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-success"
                                                    disabled={busyId === item.id}
                                                    onClick={() => approve(item)}
                                                >
                                                    <i className="bi bi-check-lg me-1" />Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger"
                                                    disabled={busyId === item.id}
                                                    onClick={() => openReject(item)}
                                                >
                                                    <i className="bi bi-x-lg me-1" />Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {rejecting && (
                <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header bg-navy text-white">
                                <h5 className="modal-title">Reject complaint</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setRejecting(null)} />
                            </div>
                            <form onSubmit={submitReject}>
                                <div className="modal-body">
                                    <p className="small text-muted">
                                        Rejecting the complaint from <strong>{rejecting.complainant_name}</strong> keeps it
                                        out of the case register. The reason is recorded in the audit log.
                                    </p>
                                    <label htmlFor="reject_reason" className="form-label">Reason <span className="text-danger">*</span></label>
                                    <textarea
                                        id="reject_reason"
                                        className="form-control"
                                        rows="3"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setRejecting(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-danger" disabled={busyId === rejecting.id}>
                                        {busyId === rejecting.id ? 'Rejecting…' : 'Reject Complaint'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
