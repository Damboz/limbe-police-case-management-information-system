import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import PasswordInput from '../../components/PasswordInput';
import usePageTitle from '../../hooks/usePageTitle';


const MIN_PASSWORD_LENGTH = 6;

const RANKS = ['Constable', 'Sergeant', 'Inspector', 'Assistant Superintendent', 'Superintendent', 'Station Commander'];

const ROLE_OPTIONS = [
    { value: 'Police Officer', label: 'Police Officer / Desk Officer' },
    { value: 'Investigator', label: 'Investigator / Detective' },
    { value: 'Supervisor', label: 'Supervisor / Station Commander' },
    { value: 'Branch In-charge', label: 'Branch In-charge' },
    { value: 'Prosecutor', label: 'Prosecutor' },
    { value: 'Admin', label: 'System Administrator' }
];


export default function UserCreate() {
    const navigate = useNavigate();
    const toast = useToast();
    const { data: options, error: optionsError, loading } = useApiData(api.personnelFormOptions);
    usePageTitle('Register Station Personnel');

    const [form, setForm] = useState({
        badge_number: '',
        rank_title: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        role: '',
        unit_id: '',
        password: ''
    });
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));
    const setDigits = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value.replace(/[^0-9]/g, '') }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const res = await api.createUser(form);
            toast.success(res.message);
            navigate('/admin/users', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="row justify-content-center">
            <div className="col-12 col-lg-8">
                <Alert variant="danger" message={optionsError} onDismiss={() => {}} />

                <div className="card shadow-sm border-0">
                    <div className="card-header bg-navy text-white d-flex align-items-center justify-content-between py-3">
                        <h6 className="mb-0 fw-bold">
                            <i className="bi bi-person-plus-fill me-2 text-warning" />Register Station Personnel
                        </h6>
                        <Link to="/admin/dashboard" className="btn btn-sm btn-outline-light">Back to Dashboard</Link>
                    </div>

                    <div className="card-body p-4">
                        <Alert variant="danger" message={error} onDismiss={() => setError(null)} />

                        <form onSubmit={handleSubmit}>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="badge_number" className="form-label">Badge / Service # *</label>
                                    <input type="text" className="form-control" id="badge_number" placeholder="e.g. MPS-4821" value={form.badge_number} onChange={set('badge_number')} required />
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="rank_title" className="form-label">Official Rank *</label>
                                    <select className="form-select" id="rank_title" value={form.rank_title} onChange={set('rank_title')} required>
                                        <option value="">Select Rank...</option>
                                        {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="first_name" className="form-label">First Name *</label>
                                    <input type="text" className="form-control" id="first_name" value={form.first_name} onChange={set('first_name')} required />
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="last_name" className="form-label">Last Name *</label>
                                    <input type="text" className="form-control" id="last_name" value={form.last_name} onChange={set('last_name')} required />
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="email" className="form-label">Official Email *</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        id="email"
                                        placeholder="name@police.gov.mw"
                                        pattern="[^@\s]+@[^@\s]+"
                                        title="Must contain an @ symbol, e.g. name@police.gov.mw"
                                        value={form.email}
                                        onChange={set('email')}
                                        required
                                    />
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="phone_number" className="form-label">Phone Number</label>
                                    <input
                                        type="tel"
                                        className="form-control"
                                        id="phone_number"
                                        placeholder="e.g. 0888123456"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        title="Numbers only"
                                        value={form.phone_number}
                                        onChange={setDigits('phone_number')}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="role" className="form-label">System Access Role (RBAC) *</label>
                                    <select className="form-select" id="role" value={form.role} onChange={set('role')} required>
                                        <option value="">Select Access Role...</option>
                                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="unit_id" className="form-label">Assigned Unit</label>
                                    <select className="form-select" id="unit_id" value={form.unit_id} onChange={set('unit_id')}>
                                        <option value="">No unit assigned</option>
                                        {(options?.units || []).map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
                                    </select>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="password" className="form-label">Initial Password *</label>
                                    <PasswordInput
                                        id="password"
                                        value={form.password}
                                        onChange={set('password')}
                                        placeholder={`Min ${MIN_PASSWORD_LENGTH} characters`}
                                        autoComplete="new-password"
                                        minLength={MIN_PASSWORD_LENGTH}
                                    />
                                </div>
                            </div>

                            <hr className="my-4 text-muted" />

                            <div className="d-flex align-items-center justify-content-between">
                                <Link to="/admin/dashboard" className="btn btn-outline-secondary">Cancel</Link>
                                <button type="submit" className="btn btn-navy px-4 fw-bold" disabled={submitting}>
                                    <i className="bi bi-check-circle me-1" />
                                    {submitting ? 'Registering…' : 'Complete Registration'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
