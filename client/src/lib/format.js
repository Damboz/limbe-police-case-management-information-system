export function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}


export function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}


export function formatNumber(value) {
    if (value === null || value === undefined || value === '') return '0';
    const num = Number(value);
    if (isNaN(num)) return String(value);
    return num.toLocaleString('en-GB');
}


export function initials(user) {
    if (!user) return 'O';
    const first = user.first_name ? user.first_name.charAt(0).toUpperCase() : 'P';
    return first;
}


export function truncate(value, max = 80) {
    if (!value) return '';
    const str = String(value);
    return str.length > max ? `${str.slice(0, max)}…` : str;
}
