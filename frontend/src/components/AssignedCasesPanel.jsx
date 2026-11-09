import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import CaseEvidenceButton from './CaseEvidenceButton';
import CourtAssignmentsPanel from './CourtAssignmentsPanel';
import { PriorityBadge, StatusBadge } from './ui';


// Investigator duty follows the case assignment, not the account role. Once an
// officer is added to a case's investigation team, this panel surfaces that work
// on whichever dashboard their role lands on. Court Standing Officer assignments
// are a separate duty and get their own panel below.
export default function AssignedCasesPanel() {
    const { data } = useApiData(api.assignedCases);

    if (!data) return null;

    const { assignedCases = [], courtCases = [], kpi, overdueDaysThreshold } = data;

    if (assignedCases.length === 0 && courtCases.length === 0) {
        return null;
    }

    return (
        <>
            {assignedCases.length > 0 && (
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                        <h6 className="mb-0 fw-bold">
                            <i className="bi bi-folder2-open me-2 text-warning" />My Investigation Assignments
                        </h6>
                        <span className="badge bg-gold text-dark">{kpi.totalAssigned} Total</span>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Case Ref</th>
                                    <th>Title &amp; Category</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Days Open</th>
                                    <th className="text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignedCases.map(item => (
                                    <tr key={item.id}>
                                        <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>#{item.ob_number}</td>
                                        <td>
                                            <div className="fw-semibold text-dark">{item.title}</div>
                                            <small className="text-muted">{item.crime_category}</small>
                                        </td>
                                        <td><PriorityBadge priority={item.priority} /></td>
                                        <td><StatusBadge status={item.status} /></td>
                                        <td>
                                            {item.status === 'Under Investigation' && item.days_open > overdueDaysThreshold ? (
                                                <span className="badge badge-priority-critical">{item.days_open} days</span>
                                            ) : (
                                                <span className="text-muted small">{item.days_open} days</span>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            <Link to={`/cases/${item.id}`} className="btn btn-sm btn-navy">
                                                <i className="bi bi-folder2-open me-1" />Open Case
                                            </Link>
                                            <CaseEvidenceButton caseId={item.id} status={item.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <CourtAssignmentsPanel courtCases={courtCases} />
        </>
    );
}
