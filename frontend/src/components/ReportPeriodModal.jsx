import { useState } from 'react';


export const REPORT_PERIODS = [
    { value: 'daily', label: 'Daily', hint: 'Cases recorded today', icon: 'bi-calendar-day-fill' },
    { value: 'weekly', label: 'Weekly', hint: 'This week (Monday – Sunday)', icon: 'bi-calendar-week-fill' },
    { value: 'monthly', label: 'Monthly', hint: 'This calendar month', icon: 'bi-calendar-month-fill' },
    { value: 'yearly', label: 'Yearly', hint: 'This calendar year', icon: 'bi-calendar-fill' },
    { value: 'all', label: 'All Time', hint: 'Everything on record', icon: 'bi-infinity' }
];


export default function ReportPeriodModal({ title = 'Generate Report', busy = false, onGenerate, onClose }) {
    const [period, setPeriod] = useState('monthly');

    const submit = (e) => {
        e.preventDefault();
        if (!busy) onGenerate(period);
    };

    return (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ background: 'rgba(15,23,42,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow">
                    <div className="modal-header bg-navy text-white">
                        <h5 className="modal-title fw-bold">
                            <i className="bi bi-file-earmark-pdf-fill me-2 text-warning" />{title}
                        </h5>
                        <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose} disabled={busy} />
                    </div>

                    <form onSubmit={submit}>
                        <div className="modal-body">
                            <p className="text-muted small mb-3">
                                Choose the reporting period the PDF should cover.
                            </p>

                            <div className="d-flex flex-column gap-2">
                                {REPORT_PERIODS.map(option => (
                                    <label
                                        key={option.value}
                                        className={`border rounded d-flex align-items-center gap-2 p-2 cursor-pointer ${period === option.value ? 'border-navy bg-light' : 'border-light'}`}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <input
                                            className="form-check-input m-0"
                                            type="radio"
                                            name="report-period"
                                            value={option.value}
                                            checked={period === option.value}
                                            onChange={() => setPeriod(option.value)}
                                        />
                                        <i className={`bi ${option.icon} ${period === option.value ? 'text-primary' : 'text-muted'}`} />
                                        <span className="lh-sm">
                                            <span className="fw-semibold d-block" style={{ fontSize: '0.85rem' }}>{option.label}</span>
                                            <small className="text-muted">{option.hint}</small>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="modal-footer" style={{ backgroundColor: 'var(--mps-bg-subtle)' }}>
                            <button type="button" className="btn btn-outline-navy btn-sm" onClick={onClose} disabled={busy}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-navy btn-sm" disabled={busy}>
                                <i className="bi bi-file-earmark-arrow-down me-1" />
                                {busy ? 'Preparing...' : 'Generate PDF'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
