const PERIOD_KEYS = ['daily', 'weekly', 'monthly', 'yearly'];


function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}


function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}


function formatDate(date, options) {
    return date.toLocaleDateString('en-GB', options);
}


// Reports are generated for one calendar window at a time. Anything that is not
// one of the four known keys falls back to "all time" so old links keep working.
function resolvePeriod(raw) {
    const key = PERIOD_KEYS.includes(raw) ? raw : 'all';

    const now = new Date();
    let start = null;
    let end = null;
    let short = 'All Time';
    let label = 'All Time';

    if (key === 'daily') {
        start = startOfDay(now);
        end = addDays(start, 1);
        short = 'Today';
        label = `Daily Report — ${formatDate(start, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`;
    } else if (key === 'weekly') {
        const mondayOffset = (now.getDay() + 6) % 7;
        start = addDays(startOfDay(now), -mondayOffset);
        end = addDays(start, 7);
        short = 'This Week';
        label = `Weekly Report — ${formatDate(start, { day: '2-digit', month: 'short', year: 'numeric' })} to ${formatDate(addDays(end, -1), { day: '2-digit', month: 'short', year: 'numeric' })}`;
    } else if (key === 'monthly') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        short = 'This Month';
        label = `Monthly Report — ${formatDate(now, { month: 'long', year: 'numeric' })}`;
    } else if (key === 'yearly') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        short = 'This Year';
        label = `Yearly Report — ${now.getFullYear()}`;
    }

    return { key, short, label, start, end };
}


// `periodWhere` is for queries that have no WHERE clause yet; `periodAnd` appends
// to an existing WHERE / JOIN condition. Both return the SQL fragment and the
// matching parameters in the order they appear in the statement.
function periodWhere(period, column) {
    if (!period || !period.start) return { sql: '', params: [] };
    return { sql: `WHERE ${column} >= ? AND ${column} < ?`, params: [period.start, period.end] };
}


function periodAnd(period, column) {
    if (!period || !period.start) return { sql: '', params: [] };
    return { sql: `AND ${column} >= ? AND ${column} < ?`, params: [period.start, period.end] };
}


module.exports = { resolvePeriod, periodWhere, periodAnd };
