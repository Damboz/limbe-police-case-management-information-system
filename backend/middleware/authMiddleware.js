const {
    ROLES,
    ROLE_IDS,
    ROLE_IDS_BY_NAME,
    canonicalRole,
    canonicalRoleId
} = require('../roles');

const ADMIN_MESSAGE = 'Access Denied. System Administrator permissions required.';
const ROLE_MESSAGE = 'Access Denied. You do not have permission to view this resource.';


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
function normalizeSessionRole(req, res, next) {
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
