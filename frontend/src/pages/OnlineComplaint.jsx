import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { Alert, Spinner } from '../components/ui';
import usePageTitle from '../hooks/usePageTitle';


const EMPTY_WITNESS = {
    full_name: '',
    phone_number: '',
    age: '',
    occupation: '',
    ta: '',
    village: '',
    address: ''
};


const EMPTY = {
    complainant_name: '',
    complainant_phone: '',
    complainant_gender: 'Other',
    complainant_id_number: '',
    complainant_age: '',
    complainant_occupation: '',
    complainant_ta: '',
    complainant_village: '',
    complainant_address: '',
    category_id: '',
    branch_id: '',
    incident_datetime: '',
    incident_location: '',
    incident_details: '',
    suspect_first_name: '',
    suspect_last_name: '',
    suspect_alias: '',
    suspect_gender: '',
    suspect_national_id: '',
    suspect_phone_number: '',
    suspect_age: '',
    suspect_occupation: '',
    suspect_ta: '',
    suspect_village: '',
    suspect_address: '',
    witnesses: []
};


export default function OnlineComplaint() {
    usePageTitle('Report a Complaint Online');
    const { data, error, loading } = useApiData(api.complaintFormOptions);
    const [form, setForm] = useState(EMPTY);
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [receipt, setReceipt] = useState(null);

    const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

    const addWitness = () => setForm(prev => ({ ...prev, witnesses: [...prev.witnesses, { ...EMPTY_WITNESS }] }));
    const removeWitness = (index) => setForm(prev => ({
        ...prev,
        witnesses: prev.witnesses.filter((_, i) => i !== index)
    }));
    const setWitness = (index, key) => (e) => setForm(prev => ({
        ...prev,
        witnesses: prev.witnesses.map((w, i) => (i === index ? { ...w, [key]: e.target.value } : w))
    }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(null);
        setSubmitting(true);

        try {
            const res = await api.submitOnlineComplaint(form);
            setReceipt({ caseId: res.data.caseId, message: res.message });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const startAnother = () => {
        setForm(EMPTY);
        setReceipt(null);
        setFormError(null);
    };

    if (loading) {
        return (
            <div className="auth-wrapper">
                <Spinner label="Loading the complaint form…" />
            </div>
        );
    }

    const categories = data?.categories || [];
    const branches = data?.branches || [];

    return (
        <div className="auth-wrapper" style={{ alignItems: 'flex-start' }}>
            <div className="card shadow-lg border-0" style={{ maxWidth: 960, width: '100%' }}>
                <div className="card-header bg-navy text-white py-4 text-center border-bottom border-3" style={{ borderColor: 'var(--mps-gold)' }}>
                    <img src="/logo/image.png" alt="Limbe Police Emblem" style={{ maxWidth: 72, height: 'auto' }} className="mb-2" />
                    <h4 className="fw-bold mb-1">Limbe Police Station</h4>
                    <div className="text-warning text-uppercase small fw-bold" style={{ letterSpacing: '0.08em' }}>
                        Online Complaint Submission
                    </div>
                </div>

                <div className="card-body p-4 p-md-5">
                    {receipt ? (
                        <div className="text-center py-4">
                            <div className="display-5 text-success mb-3"><i className="bi bi-check-circle-fill" /></div>
                            <h4 className="fw-bold mb-2">Complaint submitted</h4>
                            <p className="text-muted mb-3">{receipt.message}</p>
                            <div className="alert alert-warning d-inline-block px-4">
                                <div className="small text-uppercase fw-bold">Your complaint reference</div>
                                <div className="fs-4 fw-bold font-monospace">ONL-{String(receipt.caseId).padStart(6, '0')}</div>
                            </div>
                            <p className="text-muted small mt-3 mb-4">
                                Please keep this reference. The complaint will appear in the case register only after a
                                police officer reviews and approves it.
                            </p>
                            <div className="d-flex justify-content-center gap-2 flex-wrap">
                                <button type="button" className="btn btn-navy" onClick={startAnother}>
                                    <i className="bi bi-plus-lg me-1" />Submit another complaint
                                </button>
                                <Link to="/login" className="btn btn-outline-navy">
                                    <i className="bi bi-box-arrow-in-right me-1" />Officer sign in
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="alert alert-info small border-0">
                                <i className="bi bi-shield-check me-2" />
                                Your complaint is sent to the station for review. It becomes an official case only
                                after a police officer approves it. For emergencies, call the station directly.
                            </div>

                            <Alert variant="danger" message={formError} onDismiss={() => setFormError(null)} />

                            <form onSubmit={handleSubmit}>
                                <h6 className="fw-bold text-navy mb-3">
                                    <i className="bi bi-person-fill me-2" />Your details
                                </h6>
                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label htmlFor="complainant_name" className="form-label">Full Name <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" id="complainant_name" value={form.complainant_name} onChange={set('complainant_name')} required />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label htmlFor="complainant_phone" className="form-label">Phone Number <span className="text-danger">*</span></label>
                                        <input type="tel" className="form-control" id="complainant_phone" value={form.complainant_phone} onChange={set('complainant_phone')} required />
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="complainant_gender" className="form-label">Gender</label>
                                        <select className="form-select" id="complainant_gender" value={form.complainant_gender} onChange={set('complainant_gender')}>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="complainant_id_number" className="form-label">National ID</label>
                                        <input type="text" className="form-control" id="complainant_id_number" placeholder="Optional" value={form.complainant_id_number} onChange={set('complainant_id_number')} />
                                    </div>
                                    <div className="col-md-2 mb-3">
                                        <label htmlFor="complainant_age" className="form-label">Age</label>
                                        <input type="number" min="0" className="form-control" id="complainant_age" placeholder="Optional" value={form.complainant_age} onChange={set('complainant_age')} />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="complainant_occupation" className="form-label">Occupation</label>
                                        <input type="text" className="form-control" id="complainant_occupation" placeholder="Optional" value={form.complainant_occupation} onChange={set('complainant_occupation')} />
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="complainant_ta" className="form-label">T/A (Traditional Authority)</label>
                                        <input type="text" className="form-control" id="complainant_ta" placeholder="Optional" value={form.complainant_ta} onChange={set('complainant_ta')} />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="complainant_village" className="form-label">Village</label>
                                        <input type="text" className="form-control" id="complainant_village" placeholder="Optional" value={form.complainant_village} onChange={set('complainant_village')} />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="complainant_address" className="form-label">Physical Address</label>
                                        <input type="text" className="form-control" id="complainant_address" placeholder="Optional" value={form.complainant_address} onChange={set('complainant_address')} />
                                    </div>
                                </div>

                                <hr className="my-4" />

                                <h6 className="fw-bold text-navy mb-3">
                                    <i className="bi bi-geo-alt-fill me-2" />What happened
                                </h6>
                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label htmlFor="category_id" className="form-label">Type of Offence <span className="text-danger">*</span></label>
                                        <select className="form-select" id="category_id" value={form.category_id} onChange={set('category_id')} required>
                                            <option value="">-- Select offence --</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label htmlFor="branch_id" className="form-label">Nearest Police Branch <span className="text-danger">*</span></label>
                                        <select className="form-select" id="branch_id" value={form.branch_id} onChange={set('branch_id')} required>
                                            <option value="">-- Select branch --</option>
                                            {branches.map(branch => (
                                                <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label htmlFor="incident_location" className="form-label">Where did it happen? <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" id="incident_location" placeholder="e.g. Limbe Market, Chirimba Road" value={form.incident_location} onChange={set('incident_location')} required />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label htmlFor="incident_datetime" className="form-label">When did it happen?</label>
                                        <input type="datetime-local" className="form-control" id="incident_datetime" value={form.incident_datetime} onChange={set('incident_datetime')} />
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="incident_details" className="form-label">Tell us what happened <span className="text-danger">*</span></label>
                                    <textarea rows="5" className="form-control" id="incident_details" placeholder="Describe the incident: what happened, who was involved, and anything else the police should know." value={form.incident_details} onChange={set('incident_details')} required />
                                </div>

                                <hr className="my-4" />

                                <h6 className="fw-bold text-navy mb-1">
                                    <i className="bi bi-person-bounding-box me-2" />Suspect (optional)
                                </h6>
                                <p className="text-muted small mb-3">
                                    Only fill this in if you know the person who committed the offence.
                                </p>
                                <div className="row">
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="suspect_first_name" className="form-label">First Name</label>
                                        <input type="text" className="form-control" id="suspect_first_name" value={form.suspect_first_name} onChange={set('suspect_first_name')} />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="suspect_last_name" className="form-label">Last Name</label>
                                        <input type="text" className="form-control" id="suspect_last_name" value={form.suspect_last_name} onChange={set('suspect_last_name')} />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="suspect_alias" className="form-label">Alias / Nickname</label>
                                        <input type="text" className="form-control" id="suspect_alias" value={form.suspect_alias} onChange={set('suspect_alias')} />
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_gender" className="form-label">Gender</label>
                                        <select className="form-select" id="suspect_gender" value={form.suspect_gender} onChange={set('suspect_gender')}>
                                            <option value="">-- Select --</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_national_id" className="form-label">National ID</label>
                                        <input type="text" className="form-control" id="suspect_national_id" value={form.suspect_national_id} onChange={set('suspect_national_id')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_phone_number" className="form-label">Phone Number</label>
                                        <input type="tel" className="form-control" id="suspect_phone_number" value={form.suspect_phone_number} onChange={set('suspect_phone_number')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_age" className="form-label">Age</label>
                                        <input type="number" min="0" className="form-control" id="suspect_age" value={form.suspect_age} onChange={set('suspect_age')} />
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_occupation" className="form-label">Occupation</label>
                                        <input type="text" className="form-control" id="suspect_occupation" value={form.suspect_occupation} onChange={set('suspect_occupation')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_ta" className="form-label">T/A</label>
                                        <input type="text" className="form-control" id="suspect_ta" value={form.suspect_ta} onChange={set('suspect_ta')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_village" className="form-label">Village</label>
                                        <input type="text" className="form-control" id="suspect_village" value={form.suspect_village} onChange={set('suspect_village')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_address" className="form-label">Address</label>
                                        <input type="text" className="form-control" id="suspect_address" value={form.suspect_address} onChange={set('suspect_address')} />
                                    </div>
                                </div>

                                <hr className="my-4" />

                                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                    <h6 className="fw-bold text-navy mb-0">
                                        <i className="bi bi-people-fill me-2" />Witnesses (optional)
                                    </h6>
                                    <button type="button" className="btn btn-sm btn-outline-navy" onClick={addWitness}>
                                        <i className="bi bi-plus-lg me-1" />Add Witness
                                    </button>
                                </div>
                                {form.witnesses.length === 0 ? (
                                    <p className="text-muted small">No witnesses added.</p>
                                ) : (
                                    form.witnesses.map((witness, index) => (
                                        <div key={index} className="border rounded p-3 mb-3">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <span className="fw-semibold text-navy">Witness {index + 1}</span>
                                                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeWitness(index)}>
                                                    <i className="bi bi-trash me-1" />Remove
                                                </button>
                                            </div>
                                            <div className="row">
                                                <div className="col-md-4 mb-2">
                                                    <label className="form-label small">Full Name</label>
                                                    <input type="text" className="form-control form-control-sm" value={witness.full_name} onChange={setWitness(index, 'full_name')} />
                                                </div>
                                                <div className="col-md-4 mb-2">
                                                    <label className="form-label small">Phone Number</label>
                                                    <input type="tel" className="form-control form-control-sm" value={witness.phone_number} onChange={setWitness(index, 'phone_number')} />
                                                </div>
                                                <div className="col-md-4 mb-2">
                                                    <label className="form-label small">Age</label>
                                                    <input type="number" min="0" className="form-control form-control-sm" value={witness.age} onChange={setWitness(index, 'age')} />
                                                </div>
                                            </div>
                                            <div className="row">
                                                <div className="col-md-4 mb-2">
                                                    <label className="form-label small">Occupation</label>
                                                    <input type="text" className="form-control form-control-sm" value={witness.occupation} onChange={setWitness(index, 'occupation')} />
                                                </div>
                                                <div className="col-md-4 mb-2">
                                                    <label className="form-label small">T/A</label>
                                                    <input type="text" className="form-control form-control-sm" value={witness.ta} onChange={setWitness(index, 'ta')} />
                                                </div>
                                                <div className="col-md-4 mb-2">
                                                    <label className="form-label small">Village</label>
                                                    <input type="text" className="form-control form-control-sm" value={witness.village} onChange={setWitness(index, 'village')} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="form-label small">Address</label>
                                                <input type="text" className="form-control form-control-sm" value={witness.address} onChange={setWitness(index, 'address')} />
                                            </div>
                                        </div>
                                    ))
                                )}

                                <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mt-4">
                                    <Link to="/login" className="btn btn-outline-navy">
                                        <i className="bi bi-arrow-left me-1" />Officer sign in
                                    </Link>
                                    <button type="submit" className="btn btn-navy px-4" disabled={submitting}>
                                        {submitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                                                Submitting…
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-send-fill me-1" />Submit Complaint
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>

                <div className="card-footer bg-light text-center small text-muted">
                    <i className="bi bi-shield-lock-fill me-1 text-warning" />
                    Reports are confidential and handled by Limbe Police Station.
                </div>
            </div>
        </div>
    );
}
