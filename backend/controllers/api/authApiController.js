const authService = require('../../services/authService');
const { logAudit } = require('../../utils/audit');


exports.login = async (req, res, next) => {
    try {
        const result = await authService.authenticate(req.body.badge_number, req.body.password);

        if (!result.ok) {
            return res.status(result.status).json({ success: false, error: result.error });
        }

        const user = result.user;

        req.session.user = user;

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

    // cookie-session has no destroy(); nulling the session clears the cookie.
    req.session = null;
    res.clearCookie('limbe.sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });
    return res.json({ success: true });
};


exports.me = async (req, res) => {
    res.json({ success: true, data: { user: req.session.user } });
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
