// Helpers shared by the search endpoints (cases, evidence, users, audit logs).
// PostgreSQL is the database, so its LIKE/ILIKE semantics drive both functions.


// Build a case-insensitive "contains" pattern for ILIKE. The term's own
// wildcards are escaped so a literal % or _ cannot turn into a match-anything
// pattern, and a trailing backslash cannot corrupt the pattern. Backslash is
// PostgreSQL's default escape character for LIKE/ILIKE, so no ESCAPE clause is
// needed. The term is passed as a bound parameter, never concatenated into SQL.
function containsPattern(term) {
    const escaped = String(term == null ? '' : term)
        .trim()
        .replace(/([\\%_])/g, '\\$1');
    return `%${escaped}%`;
}


// Express parses a repeated query parameter (?q=a&q=b) into an array, which
// then breaks string operations like .trim() and silently turns exact-match
// filters into a no-op. Reduce every value to its first occurrence so handlers
// always receive the plain strings they expect.
function normalizeQuery(query) {
    const source = query && typeof query === 'object' ? query : {};
    const clean = {};
    for (const [key, value] of Object.entries(source)) {
        clean[key] = Array.isArray(value) ? value[0] : value;
    }
    return clean;
}


module.exports = { containsPattern, normalizeQuery };
