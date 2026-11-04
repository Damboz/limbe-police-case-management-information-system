import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


const STATUS_OPTIONS = [
    'Registered', 'Numbered', 'Classified', 'Assigned', 'Under Investigation',
    'Submitted for Review', 'Court Pending', 'Forwarded to Prosecution',
    'Closed', 'Archived'
];


export default function OccurrenceBook() {
    usePageTitle('Occurrence Book');

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [query, setQuery] = useState({ q: '', status: '' });

    const { data, error, loading } = useApiData(
        (signal) => api.occurrenceBook(query, signal),
        [query]
    );

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const cases = data?.cases || [];
    const total = data?.total || 0;

    const submitFilters = (e) => {
        e.preventDefault();
        setQuery({ q: search.trim(), status });
    };

    const clearFilters = () => {
        setSearch('');
        setStatus('');
        setQuery({ q: '', status: '' });
    };

    return (
        <>
            <PageHeader
                title="Occurrence Book"
                subtitle="The station's complete register of cases, including entries still awaiting an OB number."
            />

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body py-3">
                    <form className="row g-2 align-items-end" onSubmit={submitFilters}>
                        <div className="col-12 col-lg-6">
                            <label htmlFor="ob_search" className="form-label small fw-semibold">Search the Book</label>
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0">
                                    <i className="bi bi-search text-muted" />
                                </span>
                                <input
                                    id="ob_search"
                                    type="search"
                                    className="form-control border-start-0"
                                    placeholder="OB number, complainant, phone, offence, location..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-6 col-lg-3">
                            <label htmlFor="ob_status" className="form-label small fw-semibold">Status</label>
                            <select
                                id="ob_status"
                                className="form-select"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="">All statuses</option>
                                {STATUS_OPTIONS.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-6 col-lg-3 d-flex gap-2">
                            <button type="submit" className="btn btn-navy flex-grow-1">
                                <i className="bi bi-funnel-fill me-1" />Filter
                            </button>
                            <button type="button" className="btn btn-outline-navy" onClick={clearFilters}>
                                <i className="bi bi-arrow-counterclockwise" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold">
                        <i className="bi bi-journal-bookmark-fill me-2 text-warning" />Case Entries
                    </h6>
                    <span className="badge bg-gold text-dark">{total} {total === 1 ? 'Entry' : 'Entries'}</span>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>OB Number</th>
                                <th>Date Recorded</th>
                                <th>Complainant</th>
                                <th>Offence</th>
                                <th>Incident Date &amp; Location</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Recorded By</th>
                                <th>Assigned Officer</th>
                                <th className="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cases.length === 0 ? (
                                <tr>
                                    <td colSpan="10">
                                        <EmptyState icon="bi-journal-x" message="No cases match the current book filters." />
                                    </td>
                                </tr>
                            ) : (
                                cases.map(item => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>
                                                {item.ob_number || <span className="text-muted fst-italic fw-normal">Unnumbered</span>}
                                            </div>
                                            {item.criminal_number && (
                                                <small className="text-muted font-monospace">{item.criminal_number}</small>
                                            )}
                                        </td>
                                        <td className="small text-muted">{formatDateTime(item.recorded_at || item.created_at)}</td>
                                        <td>
                                            <div className="fw-semibold text-dark">{item.complainant_name}</div>
                                            <small className="text-muted">
                                                {item.complainant_phone || 'No phone'}
                                                {item.complainant_gender && ` · ${item.complainant_gender}`}
                                            </small>
                                        </td>
                                        <td className="small">{item.crime_category || '—'}</td>
                                        <td>
                                            <div className="small fw-semibold">
                                                {item.incident_datetime ? formatDate(item.incident_datetime) : '—'}
                                            </div>
                                            <small className="text-muted">{item.incident_location || '—'}</small>
                                        </td>
                                        <td><PriorityBadge priority={item.priority} /></td>
                                        <td><StatusBadge status={item.status} /></td>
                                        <td className="small">{item.recorded_by_name || '—'}</td>
                                        <td className="small">
                                            {item.assigned_officer_name
                                                ? item.assigned_officer_name
                                                : <span className="text-muted fst-italic">Unassigned</span>}
                                        </td>
                                        <td className="text-end">
                                            <Link to={`/cases/${item.id}`} className="btn btn-sm btn-outline-navy">
                                                <i className="bi bi-eye-fill me-1" />View
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
