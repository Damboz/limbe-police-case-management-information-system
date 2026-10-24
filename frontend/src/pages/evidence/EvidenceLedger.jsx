import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { formatDate } from '../../lib/format';
import usePageTitle from '../../hooks/usePageTitle';


function Label({ children }) {
    return <span className="text-muted small text-uppercase fw-semibold d-block">{children}</span>;
}


export default function EvidenceLedger() {
    usePageTitle('Evidence Ledger');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ partyId: '', type: '', q: '' });

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.evidenceLedger(filters);
            setItems(res.data?.evidenceItems || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const apply = (e) => {
        e.preventDefault();
        load();
    };

    if (loading && items.length === 0) return <Spinner />;

    return (
        <>
            <PageHeader
                title="Evidence Ledger"
                subtitle="Ledger entries with party, type, collector, date, status, hash"
                actions={
                    <>
                        <Link to="/dashboard" className="btn btn-outline-navy btn-sm">
                            <i className="bi bi-arrow-left me-1" />Back to Dashboard
                        </Link>
                        <Link to="/cases" className="btn btn-navy btn-sm">
                            <i className="bi bi-folder2-open me-1" />Case Register
                        </Link>
                    </>
                }
            />

            <Alert variant="danger" message={error} onDismiss={() => setError(null)} />

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-navy text-white py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-funnel me-2 text-warning" />Filters</h6>
                </div>
                <div className="card-body">
                    <form onSubmit={apply} className="row g-2 align-items-end">
                        <div className="col-md-3">
                            <label className="form-label small">Party ID</label>
                            <input className="form-control form-control-sm" value={filters.partyId} onChange={(e) => setFilters(p => ({ ...p, partyId: e.target.value }))} />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label small">Type</label>
                            <select className="form-select form-select-sm" value={filters.type} onChange={(e) => setFilters(p => ({ ...p, type: e.target.value }))}>
                                <option value="">All</option>
                                <option value="Physical">Physical</option>
                                <option value="Documentary">Documentary</option>
                                <option value="Digital">Digital</option>
                                <option value="Forensic">Forensic</option>
                                <option value="Weapon">Weapon</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="col-md-4">
                            <label className="form-label small">Search by ledger number</label>
                            <input className="form-control form-control-sm" placeholder="Ledger No." value={filters.q} onChange={(e) => setFilters(p => ({ ...p, q: e.target.value }))} />
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-navy btn-sm w-100">Apply</button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                    <h6 className="mb-0 fw-bold"><i className="bi bi-clipboard-check me-2 text-warning" />Evidence Ledger</h6>
                    <span className="badge bg-gold text-dark">{items.length} Items</span>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Ledger No</th>
                                <th>Case</th>
                                <th>Type</th>
                                <th>Provided By (Party/Role)</th>
                                <th>Collected By</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Hash (short)</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr><td colSpan="9"><EmptyState message="No evidence entries found." /></td></tr>
                            ) : (
                                items.map(item => (
                                    <tr key={item.id}>
                                        <td className="fw-bold font-monospace">{item.ledger_no}</td>
                                        <td><Link to={`/cases/${item.case_id}`}>#{item.ob_number || item.case_id}</Link></td>
                                        <td>{item.evidence_type}</td>
                                        <td>{item.party_name || '-'} {item.party_type ? `(${item.party_type})` : ''}</td>
                                        <td className="small">{item.collected_by_name || '-'}</td>
                                        <td className="small">{item.collected_at ? formatDate(item.collected_at) : '-'}</td>
                                        <td>{item.status}</td>
                                        <td className="small font-monospace">{item.sha256 ? item.sha256.substring(0, 12) + '...' : '-'}</td>
                                        <td><Link to={`/evidence/${item.id}`} className="btn btn-outline-navy btn-sm">Detail</Link></td>
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
