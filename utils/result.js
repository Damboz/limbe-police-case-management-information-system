function ok(data) {
    return { ok: true, ...(data || {}) };
}

function fail(status, error) {
    return { ok: false, status, error };
}

function fromResult(res, result, successMessage) {
    if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
    }
    return res.json({
        success: true,
        ...(successMessage ? { message: successMessage } : {}),
        data: result.data === undefined ? undefined : result.data
    });
}

module.exports = { ok, fail, fromResult };
