import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, EmptyState, PageHeader, PriorityBadge, Spinner, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { objectToParams } from '../../lib/searchParams';
import usePageTitle from '../../hooks/usePageTitle';


const MIN_QUERY_LENGTH = 2;

const SEARCH_TYPES = [
    { value: 'all', label: 'All Types' },
    { value: 'national_id', label: 'National ID (Complainant)' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'suspect', label: 'Suspect Name/ID' },
    { value: 'victim', label: 'Victim Name/ID' }
];


export default function CaseSearch() {
    const [searchParams, setSearchParams] = useSearchParams();
    usePageTitle('Smart Case Search');

    // The URL is the source of truth so results stay bookmarkable and survive reloads.
    const appliedQuery = (searchParams.get('q') || '').trim();
    const appliedType = searchParams.get('type') || 'all';

    const [query, setQuery] = useState(appliedQuery);
    const [searchType, setSearchType] = useState(appliedType);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const searched = appliedQuery.length >= MIN_QUERY_LENGTH;

    useEffect(() => {
        if (appliedQuery.length < MIN_QUERY_LENGTH) {
            setResult(null);
            setError(null);
            setLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        let active = true;

        setLoading(true);
        setError(null);

        api.searchCases({ q: appliedQuery, type: appliedType }, controller.signal)
            .then((res) => {
                if (active) setResult(res.data);
            })
            .catch((err) => {
                if (!active || err.name === 'AbortError') return;
                setError(err.message);
                setResult(null);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [appliedQuery, appliedType]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const trimmed = query.trim();
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setError(`Please enter at least ${MIN_QUERY_LENGTH} characters to search.`);
            setResult(null);
            return;
        }

        setError(null);
        setSearchParams(objectToParams({ q: trimmed, type: searchType === 'all' ? '' : searchType }));
    };

    const results = result?.results || [];

    return (
        <>
            <PageHeader
                title="Smart Search"
                subtitle="Quick lookup by National ID, phone number, suspect name, or victim name."
                actions={
                    <Link to="/dashboard" className="btn btn-outline-navy btn-sm">
                        <i className="bi bi-arrow-left me-1" />Back to Dashboard
                    </Link>
                }
            />

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold">
                        <i className="bi bi-search me-2 text-warning" />Search Criteria
                    </h6>
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit} className="row g-3 align-items-end">
                        <div className="col-md-6">
                            <label htmlFor="q" className="form-label small text-muted fw-semibold">Search Query</label>
                            <input
                                type="text"
                                className="form-control"
                                id="q"
                                placeholder="Enter National ID, phone number, suspect name, or victim name..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                minLength={MIN_QUERY_LENGTH}
                                autoFocus
                            />
                        </div>
                        <div className="col-md-4">
                            <label htmlFor="type" className="form-label small text-muted fw-semibold">Search Type</label>
                            <select className="form-select" id="type" value={searchType} onChange={e => setSearchType(e.target.value)}>
                                {SEARCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <button type="submit" className="btn btn-navy w-100" disabled={loading}>
                                {loading ? 'Searching…' : <><i className="bi bi-search me-1" />Search</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <Alert variant="danger" message={error} onDismiss={() => setError(null)} />

            {loading && <Spinner label="Searching records…" />}

            {!loading && searched && !error && (
                <div className="card border-0 shadow-sm">
                    <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                        <h6 className="mb-0 fw-bold">
                            <i className="bi bi-list-check me-2 text-warning" />Search Results
                        </h6>
                        <span className="badge bg-gold text-dark">{results.length} Match(es)</span>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>OB Number</th>
                                    <th>Match Type</th>
                                    <th>Name / Details</th>
                                    <th>Category</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th className="text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.length === 0 ? (
                                    <tr>
                                        <td colSpan="8">
                                            <EmptyState
                                                icon="bi-search"
                                                message={
                                                    <>
                                                        No records found matching &ldquo;<strong>{result?.query}</strong>&rdquo;.
                                                        <br />
                                                        <small>Try a different search term or broaden the search type.</small>
                                                    </>
                                                }
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    results.map(item => (
                                        <tr key={`${item.id}-${item.match_type}`}>
                                            <td className="fw-bold font-monospace" style={{ color: 'var(--mps-navy)' }}>{item.ob_number}</td>
                                            <td><span className="badge bg-light text-dark border">{item.match_type}</span></td>
                                            <td className="small fw-semibold">
                                                {item.complainant_name}
                                                {item.suspect_name && (
                                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Suspect: {item.suspect_name}</div>
                                                )}
                                                {item.victim_name && (
                                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>Victim: {item.victim_name}</div>
                                                )}
                                            </td>
                                            <td className="small">{item.crime_category || '—'}</td>
                                            <td><PriorityBadge priority={item.priority} /></td>
                                            <td><StatusBadge status={item.status} /></td>
                                            <td className="small text-muted">{formatDate(item.created_at)}</td>
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
            )}
        </>
    );
}
