import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const counter = useRef(0);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const push = useCallback((variant, message) => {
        if (!message) return;
        const id = ++counter.current;
        setToasts(prev => [...prev, { id, variant, message }]);
        setTimeout(() => dismiss(id), 6000);
    }, [dismiss]);

    const success = useCallback((msg) => push('success', msg), [push]);
    const error = useCallback((msg) => push('danger', msg), [push]);
    const info = useCallback((msg) => push('info', msg), [push]);

    const value = useMemo(() => ({ success, error, info }), [success, error, info]);

    const icons = {
        success: 'bi-check-circle-fill',
        danger: 'bi-exclamation-octagon-fill',
        info: 'bi-info-circle-fill'
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                className="position-fixed top-0 end-0 p-3 d-flex flex-column gap-2"
                style={{ zIndex: 2000, maxWidth: '26rem' }}
                aria-live="polite"
                aria-atomic="true"
            >
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`alert alert-${toast.variant} alert-dismissible fade show small mb-0 border-0 shadow-sm`}
                        role="alert"
                    >
                        <i className={`bi ${icons[toast.variant] || icons.info} me-2`} />
                        {toast.message}
                        <button
                            type="button"
                            className="btn-close"
                            aria-label="Close"
                            onClick={() => dismiss(toast.id)}
                        />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
}
