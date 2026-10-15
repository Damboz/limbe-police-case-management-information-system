const authService = require('../../services/authService');
const { logAudit } = require('../../utils/audit');
const { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SESSION_MAX_AGE } = require('../../config/session');


exports.login = async (req, res, next) => {
    try {
        const result = await authService.authenticate(req.body.badge_number, req.body.password);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        const user = result.user;

        req.session.user = user;

        // Stamp the session so enforceSessionTimeout can measure idle time and enforce
        // the absolute cap. A fresh login always starts a fresh window.
        const now = Date.now();
        req.session.lastSeen = now;
        req.session.expiresAt = now + SESSION_MAX_AGE;

        await logAudit(req, user.id, 'USER_LOGIN', `Officer ${user.badge_number} logged in successfully.`);

        return res.json({ success: true, data: { user } });
    } catch (err) {
        next(err);
    }
};


exports.logout = async (req, res) => {
    const user = req.session && req.session.user;

    if (!user) {
        return res.json({ success: true });
    }

    await logAudit(req, user.id, 'USER_LOGOUT', `Officer ${user.badge_number} logged out.`);

    // cookie-session has no destroy(); nulling the session empties the cookie. The
    // explicit clearCookie below removes it entirely — but only if its attributes
    // (SameSite/Secure/path) match the ones the session was created with, so both
    // come from config/session.js. A mismatch here previously left the cookie in the
    // browser and the next officer opened the app already signed in as someone else.
    req.session = null;
    res.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
    return res.json({ success: true });
};


exports.me = async (req, res, next) => {
    try {
        const current = req.session && req.session.user;
        if (!current) {
            return res.status(401).json({ success: false, error: 'Please log in to access this page.' });
        }

        // The cookie is a snapshot taken at login, so re-read the account before
        // trusting it. This is what stops a deactivated, deleted or re-roled
        // officer from opening the app on a still-valid 8-hour cookie and landing
        // on a dashboard they are no longer entitled to.
        const user = await authService.refreshSessionUser(current);
        if (!user) {
            req.session = null; // cookie-session clears the cookie on the way out
            return res.status(401).json({
                success: false,
                error: 'Your account is no longer active. Please log in again.'
            });
        }

        // Refresh the signed cookie so role/branch changes take effect immediately
        // and every later guard authorizes against the current database values.
        req.session.user = user;
        return res.json({ success: true, data: { user } });
    } catch (err) {
        next(err);
    }
};


exports.changePassword = async (req, res, next) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;

        const result = await authService.changePassword(
            req.session.user,
            current_password,
            new_password,
            confirm_password
        );

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        await logAudit(req, req.session.user.id, 'PASSWORD_CHANGED', `Officer ${result.badgeNumber} updated their password.`);

        return res.json({ success: true, message: 'Password updated successfully!' });
    } catch (err) {
        next(err);
    }
};
