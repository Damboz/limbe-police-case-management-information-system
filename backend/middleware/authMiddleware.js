const {
    ROLES,
    ROLE_IDS,
    ROLE_IDS_BY_NAME,
    canonicalRole,
    canonicalRoleId
} = require('../roles');
const db = require('../config/db');
const { SESSION_IDLE_TIMEOUT, SESSION_MAX_AGE } = require('../config/session');

const ADMIN_MESSAGE = 'Access Denied. System Administrator permissions required.';
const ROLE_MESSAGE = 'Access Denied. You do not have permission to view this resource.';

// Activity is only written back to the cookie once a minute. Updating on every request
// would re-issue the Set-Cookie header on nearly every response, and a minute of slack
// is invisible against a multi-minute idle window.
const ACTIVITY_WRITE_INTERVAL = 60 * 1000;


// This service only speaks JSON. It used to redirect browsers into the SPA on an
// auth failure, but the SPA is a separate deployment now, and a redirect would send
// the request to the API's own origin and hand the caller an HTML login page.
function denyUnauthenticated(req, res) {
    return res.status(401).json({ success: false, error: 'Please log in to access this page.' });
}


function denyForbidden(req, res, message) {
    return res.status(403).json({ success: false, error: message });
}


// Sessions created before the workflow rollout still carry the old
// role names and role ids. Rewrite them in place so every
// downstream role check sees the new canonical values; the
// encrypted session cookie is then re-issued with the fix.
async function normalizeSessionRole(req, res, next) {
    const user = req.session && req.session.user;
    if (user) {
        const role = canonicalRole(user.role);
        if (role) {
            user.role = role;
        }
        const roleId = canonicalRoleId(user.role_id);
        if (roleId) {
            user.role_id = roleId;
        }

        // Sessions minted before the workflow branch was added to the login
        // projection carry no `branch`, which would hide a Branch Officer's
        // entire dashboard. Rehydrate it once; the session cookie is
        // re-issued with the value on this response.
        if (!user.branch && user.role === ROLES.BRANCH_OFFICER) {
            try {
                const [rows] = await db.execute('SELECT branch FROM users WHERE id = ?', [user.id]);
                if (rows.length > 0 && rows[0].branch) {
                    user.branch = rows[0].branch;
                }
            } catch (err) {
                // Non-fatal: the dashboard will simply have no branch to filter by.
            }
        }
    }
    return next();
}


// End a session that has been idle too long, or that has outlived its absolute cap.
// cookie-session stores the whole session in the cookie and only re-issues it when the
// session changes, so activity is tracked with a `lastSeen` timestamp that is refreshed
// as the officer uses the app. When the window lapses the session is dropped here and
// every downstream guard answers 401, which sends the browser back to the login page
// instead of leaving the previous officer's dashboard open.
function enforceSessionTimeout(req, res, next) {
    const session = req.session;
    if (!session || !session.user) {
        return next();
    }

    const now = Date.now();
    const lastSeen = Number(session.lastSeen) || 0;
    const expiresAt = Number(session.expiresAt) || 0;

    // Sessions minted before idle tracking existed carry no timestamps. Adopt them
    // rather than expiring every current officer the moment this ships.
    if (!lastSeen) {
        session.lastSeen = now;
        session.expiresAt = expiresAt || now + SESSION_MAX_AGE;
        return next();
    }

    const idleExpired = now - lastSeen > SESSION_IDLE_TIMEOUT;
    const absoluteExpired = expiresAt > 0 && now > expiresAt;

    if (idleExpired || absoluteExpired) {
        req.session = null; // cookie-session clears the cookie on the way out
        return next();
    }

    if (now - lastSeen > ACTIVITY_WRITE_INTERVAL) {
        session.lastSeen = now;
    }
    return next();
}


exports.isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    return denyUnauthenticated(req, res);
};


exports.isAdmin = (req, res, next) => {
    if (req.session && req.session.user) {
        const role = canonicalRole(req.session.user.role);
        const roleId = canonicalRoleId(req.session.user.role_id);
        if (role === ROLES.ADMIN || roleId === ROLE_IDS.ADMIN) {
            return next();
        }
    }
    return denyForbidden(req, res, ADMIN_MESSAGE);
};


exports.denyAdmin = (req, res, next) => {
    if (req.session && req.session.user) {
        const role = canonicalRole(req.session.user.role);
        const roleId = canonicalRoleId(req.session.user.role_id);
        if (role !== ROLES.ADMIN && roleId !== ROLE_IDS.ADMIN) {
            return next();
        }
    }
    return denyForbidden(req, res, 'Access Denied. System administrators only manage user accounts.');
};


exports.authorizeRoles = (...allowedRoles) => {
    const allowedRoleIds = allowedRoles
        .map(role => ROLE_IDS_BY_NAME[role])
        .filter(id => id !== undefined);

    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return denyUnauthenticated(req, res);
        }

        const userRole = canonicalRole(req.session.user.role);
        const userRoleId = canonicalRoleId(req.session.user.role_id);

        if (userRole && allowedRoles.includes(userRole)) {
            return next();
        }
        if (userRoleId && allowedRoleIds.includes(userRoleId)) {
            return next();
        }

        return denyForbidden(req, res, ROLE_MESSAGE);
    };
};


exports.normalizeSessionRole = normalizeSessionRole;
exports.enforceSessionTimeout = enforceSessionTimeout;
