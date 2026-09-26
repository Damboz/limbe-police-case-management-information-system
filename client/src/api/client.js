class ApiError extends Error {
    constructor(message, status, payload) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.payload = payload;
    }
}


async function request(path, { method = 'GET', body, signal } = {}) {
    const options = {
        method,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal
    };

    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(`/api${path}`, options);
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, null);
    }

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
        const message = (isJson && payload && payload.error)
            ? payload.error
            : `Request failed (${res.status}).`;
        throw new ApiError(message, res.status, payload);
    }

    return payload;
}


function fileNameFromDisposition(header, fallback) {
    if (!header) return fallback;
    const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8) {
        try {
            return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ''));
        } catch (err) {
            return fallback;
        }
    }
    const plain = header.match(/filename="?([^";]+)"?/i);
    return plain ? plain[1].trim() : fallback;
}


async function requestBlob(path, { method = 'POST', body, fileName = 'document.pdf' } = {}) {
    const options = {
        method,
        credentials: 'same-origin',
        headers: { Accept: 'application/pdf, application/json' }
    };

    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(`/api${path}`, options);
    } catch (err) {
        throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, null);
    }

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!res.ok || isJson) {
        const payload = isJson ? await res.json().catch(() => null) : await res.text();
        if (!res.ok) {
            throw new ApiError((payload && payload.error) || `Request failed (${res.status}).`, res.status, payload);
        }
        return payload;
    }

    const blob = await res.blob();
    const name = fileNameFromDisposition(res.headers.get('content-disposition'), fileName);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, downloaded: true, fileName: name };
}


function toQuery(params) {
    if (!params) return '';
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            search.append(key, value);
        }
    });
    const str = search.toString();
    return str ? `?${str}` : '';
}


export const api = {
    login: (badge_number, password) => request('/auth/login', { method: 'POST', body: { badge_number, password } }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: (signal) => request('/auth/me', { signal }),
    changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),

    dashboard: (signal) => request('/dashboard', { signal }),
    myAnalytics: (signal) => request('/my-analytics', { signal }),

    listCases: (signal) => request('/cases', { signal }),
    caseFormOptions: (signal) => request('/cases/new', { signal }),
    createCase: (body) => request('/cases', { method: 'POST', body }),
    searchCases: (params, signal) => request(`/cases/search${toQuery(params)}`, { signal }),
    caseDetail: (id, signal) => request(`/cases/${id}`, { signal }),
    addCaseNote: (id, note) => request(`/cases/${id}/notes`, { method: 'POST', body: { note } }),
    requestCaseStatus: (id, body) => request(`/cases/${id}/request-status`, { method: 'POST', body }),
    addCaseEvidence: (id, body) => request(`/cases/${id}/evidence`, { method: 'POST', body }),
    linkSuspect: (id, body) => request(`/cases/${id}/suspects`, { method: 'POST', body }),
    linkVictim: (id, body) => request(`/cases/${id}/victims`, { method: 'POST', body }),
    suspectInvitation: (id, suspectId, body) => requestBlob(
        `/cases/${id}/suspects/${suspectId}/letter`,
        {
            method: 'POST',
            body,
            fileName: `Invitation_Letter_Case_${id}_Suspect_${suspectId}.pdf`
        }
    ),

    evidenceLedger: (params, signal) => request(`/evidence${toQuery(params)}`, { signal }),
    updateEvidenceStatus: (id, body) => request(`/evidence/${id}/status`, { method: 'POST', body }),
    transferEvidence: (id, body) => request(`/evidence/${id}/transfer`, { method: 'POST', body }),
    disposeEvidence: (id, body) => request(`/evidence/${id}/dispose`, { method: 'POST', body }),

    adminDashboard: (signal) => request('/admin/dashboard', { signal }),
    listUsers: (params, signal) => request(`/admin/users${toQuery(params)}`, { signal }),
    personnelFormOptions: (signal) => request('/admin/users/form-options', { signal }),
    getUser: (id, signal) => request(`/admin/users/${id}`, { signal }),
    createUser: (body) => request('/admin/users', { method: 'POST', body }),
    updateUser: (id, body) => request(`/admin/users/${id}`, { method: 'PUT', body }),
    resetUserPassword: (id, body) => request(`/admin/users/${id}/reset-password`, { method: 'POST', body }),
    toggleUserStatus: (id) => request(`/admin/users/${id}/toggle-status`, { method: 'POST' }),
    deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    auditLogs: (params, signal) => request(`/admin/audit-logs${toQuery(params)}`, { signal }),
    clearAuditLogs: () => request('/admin/audit-logs', { method: 'DELETE' }),

    supervisorDashboard: (signal) => request('/supervisor/dashboard', { signal }),
    assignCase: (body) => request('/supervisor/cases/assign', { method: 'POST', body }),
    approveStatus: (body) => request('/supervisor/cases/approve-status', { method: 'POST', body }),
    supervisorAnalytics: (signal) => request('/supervisor/analytics', { signal }),
    supervisorHotspots: (signal) => request('/supervisor/analytics/hotspots', { signal }),
    supervisorCategories: (signal) => request('/supervisor/analytics/categories', { signal })
};

export { ApiError };
