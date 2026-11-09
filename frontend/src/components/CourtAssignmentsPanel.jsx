import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from './ui';
import { formatDate } from '../lib/format';


// Cases where the signed-in officer is the Court Standing Officer. These are not
// investigation assignments, so they get their own panel. The download buttons
// only appear on this panel and on the case detail page, and the backend checks
// the court assignment again before sending anything.
export default function CourtAssignmentsPanel({ courtCases = [] }) {
    const toast = useToast();
    const [busyKey, setBusyKey] = useState(null);

    if (!courtCases || courtCases.length === 0) return null;

    const download = async (item, format) => {
        setBusyKey(`${item.id}-${format}`);
        try {
            const res = format === 'zip'
                ? await api.courtCaseFileZip(item.id)
                : await api.courtCaseFilePdf(item.id);
            toast.success(`${res.fileName} downloaded.`);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                <h6 className="mb-0 fw-bold">
                    <i className="bi bi-bank me-2 text-warning" />Court Standing Assignments
                </h6>
                <span className="badge bg-gold text-dark">{courtCases.length} Case{courtCases.length === 1 ? '' : 's'}</span>
            </div>
            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Case Ref</th>
                            <th>Court Date</th>
                            <th>Title &amp; Category</th>
                            <th>Status</th>
                            <th className="text-end">Case File</th>
                        </tr>
                    </thead>
                    <tbody>
                        {courtCases.map(item => (
                            <tr key={item.id}>
                                <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>
                                    #{item.ob_number}
                                    {item.criminal_number && (
                                        <div className="text-muted small fw-normal">{item.criminal_number}</div>
                                    )}
                                </td>
                                <td className="small">{item.court_date ? formatDate(item.court_date) : 'Not set'}</td>
                                <td>
                                    <div className="fw-semibold text-dark">{item.title}</div>
                                    <small className="text-muted">{item.crime_category}</small>
                                </td>
                                <td><StatusBadge status={item.status} /></td>
                                <td className="text-end text-nowrap">
                                    <Link to={`/cases/${item.id}`} className="btn btn-sm btn-navy me-1">
                                        <i className="bi bi-folder2-open me-1" />Open
                                    </Link>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-navy me-1"
                                        disabled={busyKey === `${item.id}-pdf`}
                                        onClick={() => download(item, 'pdf')}
                                    >
                                        <i className="bi bi-file-earmark-pdf me-1" />PDF
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-navy"
                                        disabled={busyKey === `${item.id}-zip`}
                                        onClick={() => download(item, 'zip')}
                                    >
                                        <i className="bi bi-file-earmark-zip me-1" />ZIP
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
