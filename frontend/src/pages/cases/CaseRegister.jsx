import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { useToast } from '../../context/ToastContext';
import { Alert, PageHeader, Spinner } from '../../components/ui';
import usePageTitle from '../../hooks/usePageTitle';


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
    priority: '',
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


export default function CaseRegister() {
    const navigate = useNavigate();
    const toast = useToast();
    const { data, error, loading } = useApiData(api.caseFormOptions);
    usePageTitle('Register New Case');
    const [form, setForm] = useState(EMPTY);
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

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
            const res = await api.createCase(form);
            toast.success(res.message);
            navigate(`/cases/${res.data.caseId}`);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <Spinner />;
    if (error) return <Alert variant="danger" message={error} />;

    const categories = data?.categories || [];
    const branches = data?.branches || [];

    return (
        <>
            <PageHeader
                title="Register New Case"
                subtitle="Record a new Occurrence Book (OB) entry from a walk-in complaint or field report."
                actions={
                    <Link to="/cases" className="btn btn-outline-navy btn-sm">
                        <i className="bi bi-arrow-left me-1" />Back to Case Register
                    </Link>
                }
            />

            <Alert variant="danger" message={formError} onDismiss={() => setFormError(null)} />

            <form onSubmit={handleSubmit}>
                <div className="row g-4">
                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-header bg-navy text-white py-3">
                                <h6 className="mb-0 fw-bold">
                                    <i className="bi bi-person-fill me-2 text-warning" />Complainant Information
                                </h6>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label htmlFor="complainant_name" className="form-label">Full Name <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control" id="complainant_name" value={form.complainant_name} onChange={set('complainant_name')} required />
                                </div>

                                <div className="row">
                                    <div className="col-sm-6 mb-3">
                                        <label htmlFor="complainant_phone" className="form-label">Phone Number <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" id="complainant_phone" value={form.complainant_phone} onChange={set('complainant_phone')} required />
                                    </div>
                                    <div className="col-sm-6 mb-3">
                                        <label htmlFor="complainant_gender" className="form-label">Gender</label>
                                        <select className="form-select" id="complainant_gender" value={form.complainant_gender} onChange={set('complainant_gender')}>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="complainant_id_number" className="form-label">National ID Number</label>
                                    <input type="text" className="form-control" id="complainant_id_number" placeholder="Optional" value={form.complainant_id_number} onChange={set('complainant_id_number')} />
                                </div>

                                <div className="row">
                                    <div className="col-sm-6 mb-3">
                                        <label htmlFor="complainant_age" className="form-label">Age</label>
                                        <input type="number" min="0" className="form-control" id="complainant_age" placeholder="Optional" value={form.complainant_age} onChange={set('complainant_age')} />
                                    </div>
                                    <div className="col-sm-6 mb-3">
                                        <label htmlFor="complainant_occupation" className="form-label">Occupation</label>
                                        <input type="text" className="form-control" id="complainant_occupation" placeholder="Optional" value={form.complainant_occupation} onChange={set('complainant_occupation')} />
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-sm-6 mb-3">
                                        <label htmlFor="complainant_ta" className="form-label">T/A (Traditional Authority)</label>
                                        <input type="text" className="form-control" id="complainant_ta" placeholder="Optional" value={form.complainant_ta} onChange={set('complainant_ta')} />
                                    </div>
                                    <div className="col-sm-6 mb-3">
                                        <label htmlFor="complainant_village" className="form-label">Village</label>
                                        <input type="text" className="form-control" id="complainant_village" placeholder="Optional" value={form.complainant_village} onChange={set('complainant_village')} />
                                    </div>
                                </div>

                                <div className="mb-0">
                                    <label htmlFor="complainant_address" className="form-label">Physical Address</label>
                                    <textarea rows="2" className="form-control" id="complainant_address" placeholder="Optional" value={form.complainant_address} onChange={set('complainant_address')} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-header bg-navy text-white py-3">
                                <h6 className="mb-0 fw-bold">
                                    <i className="bi bi-tags-fill me-2 text-warning" />Classification
                                </h6>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label htmlFor="category_id" className="form-label">Crime Category <span className="text-danger">*</span></label>
                                    <select className="form-select" id="category_id" value={form.category_id} onChange={set('category_id')} required>
                                        <option value="">-- Select Category --</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name} ({cat.severity_level})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="branch_id" className="form-label">Assigned Branch <span className="text-danger">*</span></label>
                                    <select className="form-select" id="branch_id" value={form.branch_id} onChange={set('branch_id')} required>
                                        <option value="">-- Select Branch --</option>
                                        {branches.map(branch => (
                                            <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mb-0">
                                    <label htmlFor="priority" className="form-label">Priority Level</label>
                                    <select className="form-select" id="priority" value={form.priority} onChange={set('priority')}>
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-navy text-white py-3">
                                <h6 className="mb-0 fw-bold">
                                    <i className="bi bi-geo-alt-fill me-2 text-warning" />Incident Details
                                </h6>
                            </div>
                            <div className="card-body">
                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label htmlFor="incident_location" className="form-label">Incident Location <span className="text-danger">*</span></label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="incident_location"
                                            placeholder="e.g. Limbe Market, Chirimba Road"
                                            value={form.incident_location}
                                            onChange={set('incident_location')}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label htmlFor="incident_datetime" className="form-label">Date &amp; Time of Incident</label>
                                        <input type="datetime-local" className="form-control" id="incident_datetime" value={form.incident_datetime} onChange={set('incident_datetime')} />
                                    </div>
                                </div>

                                <div className="mb-0">
                                    <label htmlFor="incident_details" className="form-label">Incident Narrative <span className="text-danger">*</span></label>
                                    <textarea
                                        rows="5"
                                        className="form-control"
                                        id="incident_details"
                                        placeholder="Describe what was reported: what happened, who was involved, and any immediate observations."
                                        value={form.incident_details}
                                        onChange={set('incident_details')}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="card border-0 shadow-sm border-warning">
                            <div className="card-header bg-warning text-dark py-3">
                                <h6 className="mb-0 fw-bold">
                                    <i className="bi bi-person-bounding-box me-2" />Suspect Information
                                    <span className="badge bg-light text-dark ms-2" style={{ fontSize: '0.7rem' }}>Optional</span>
                                </h6>
                            </div>
                            <div className="card-body">
                                <p className="text-muted small mb-3">
                                    Only fill in this section if the complainant knows the person who committed the offence.
                                    When the complainant identifies the suspect, the intake officer is able to send him/her a written
                                    invitation to appear at the station.
                                </p>
                                <div className="row">
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="suspect_first_name" className="form-label">First Name <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" id="suspect_first_name" placeholder="Required if suspect is known" value={form.suspect_first_name} onChange={set('suspect_first_name')} />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="suspect_last_name" className="form-label">Last Name <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" id="suspect_last_name" placeholder="Required if suspect is known" value={form.suspect_last_name} onChange={set('suspect_last_name')} />
                                    </div>
                                    <div className="col-md-4 mb-3">
                                        <label htmlFor="suspect_alias" className="form-label">Alias / Nickname</label>
                                        <input type="text" className="form-control" id="suspect_alias" placeholder="Optional" value={form.suspect_alias} onChange={set('suspect_alias')} />
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
                                        <label htmlFor="suspect_national_id" className="form-label">National ID Number</label>
                                        <input type="text" className="form-control" id="suspect_national_id" placeholder="Optional" value={form.suspect_national_id} onChange={set('suspect_national_id')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_phone_number" className="form-label">Phone Number</label>
                                        <input type="text" className="form-control" id="suspect_phone_number" placeholder="Optional" value={form.suspect_phone_number} onChange={set('suspect_phone_number')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_age" className="form-label">Age</label>
                                        <input type="number" min="0" className="form-control" id="suspect_age" placeholder="Optional" value={form.suspect_age} onChange={set('suspect_age')} />
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_occupation" className="form-label">Occupation</label>
                                        <input type="text" className="form-control" id="suspect_occupation" placeholder="Optional" value={form.suspect_occupation} onChange={set('suspect_occupation')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_ta" className="form-label">T/A (Traditional Authority)</label>
                                        <input type="text" className="form-control" id="suspect_ta" placeholder="Optional" value={form.suspect_ta} onChange={set('suspect_ta')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_village" className="form-label">Village</label>
                                        <input type="text" className="form-control" id="suspect_village" placeholder="Optional" value={form.suspect_village} onChange={set('suspect_village')} />
                                    </div>
                                    <div className="col-md-3 mb-3">
                                        <label htmlFor="suspect_address" className="form-label">Physical Address</label>
                                        <input type="text" className="form-control" id="suspect_address" placeholder="Optional — used on the letter" value={form.suspect_address} onChange={set('suspect_address')} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="card border-0 shadow-sm border-info">
                            <div className="card-header bg-info text-dark py-3 d-flex justify-content-between align-items-center">
                                <h6 className="mb-0 fw-bold">
                                    <i className="bi bi-people-fill me-2" />Witness Information
                                    <span className="badge bg-light text-dark ms-2" style={{ fontSize: '0.7rem' }}>Optional</span>
                                </h6>
                                <button type="button" className="btn btn-sm btn-light" onClick={addWitness}>
                                    <i className="bi bi-plus-lg me-1" />Add Witness
                                </button>
                            </div>
                            <div className="card-body">
                                {form.witnesses.length === 0 ? (
                                    <p className="text-muted small mb-0">
                                        No witnesses added. Click &ldquo;Add Witness&rdquo; to record a person who witnessed the incident.
                                    </p>
                                ) : (
                                    form.witnesses.map((witness, index) => (
                                        <div key={index} className="border rounded p-3 mb-3">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <span className="fw-semibold text-navy">Witness {index + 1}</span>
                                                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeWitness(index)}>
                                                    <i className="bi bi-trash me-1" />Remove
                                                </button>
                                            </div>
                                            <div className="row">
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label">Full Name</label>
                                                    <input type="text" className="form-control" value={witness.full_name} onChange={setWitness(index, 'full_name')} />
                                                </div>
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label">Phone Number</label>
                                                    <input type="text" className="form-control" value={witness.phone_number} onChange={setWitness(index, 'phone_number')} />
                                                </div>
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label">Age</label>
                                                    <input type="number" min="0" className="form-control" value={witness.age} onChange={setWitness(index, 'age')} />
                                                </div>
                                            </div>
                                            <div className="row">
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label">Occupation</label>
                                                    <input type="text" className="form-control" value={witness.occupation} onChange={setWitness(index, 'occupation')} />
                                                </div>
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label">T/A (Traditional Authority)</label>
                                                    <input type="text" className="form-control" value={witness.ta} onChange={setWitness(index, 'ta')} />
                                                </div>
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label">Village</label>
                                                    <input type="text" className="form-control" value={witness.village} onChange={setWitness(index, 'village')} />
                                                </div>
                                            </div>
                                            <div className="mb-0">
                                                <label className="form-label">Physical Address</label>
                                                <input type="text" className="form-control" value={witness.address} onChange={setWitness(index, 'address')} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-12 d-flex justify-content-end gap-2">
                        <Link to="/cases" className="btn btn-outline-navy">Cancel</Link>
                        <button type="submit" className="btn btn-navy px-4" disabled={submitting}>
                            {submitting ? 'Registering…' : <><i className="bi bi-check-lg me-1" />Register Case</>}
                        </button>
                    </div>
                </div>
            </form>
        </>
    );
}
