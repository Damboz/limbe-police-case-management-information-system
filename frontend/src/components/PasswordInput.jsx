import { useState } from 'react';


export default function PasswordInput({ id, value, onChange, placeholder = '••••••••', autoComplete, required = true, minLength, label }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="input-group shadow-sm">
            {label && <span className="input-group-text bg-white border-end-0"><i className="bi bi-key text-muted" /></span>}
            <input
                type={visible ? 'text' : 'password'}
                className={`form-control ${label ? 'border-start-0 border-end-0 ps-0' : ''}`}
                id={id}
                name={id}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                autoComplete={autoComplete}
                required={required}
                minLength={minLength}
            />
            <span
                className="input-group-text bg-white border-start-0"
                role="button"
                tabIndex={0}
                aria-label={visible ? 'Hide password' : 'Show password'}
                style={{ cursor: 'pointer' }}
                onClick={() => setVisible(v => !v)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setVisible(v => !v);
                    }
                }}
            >
                <i className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'} text-muted`} />
            </span>
        </div>
    );
}
