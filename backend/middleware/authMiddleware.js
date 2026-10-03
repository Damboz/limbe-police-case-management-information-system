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


exports.isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    return denyUnauthenticated(req, res);
};


exports.isAdmin = (req, res, next) => {
    if (req.session && req.session.user) {
        const role = String(req.session.user.role || '').toLowerCase();
        const roleId = req.session.user.role_id;
        if (role === 'admin' || roleId === 1) {
            return next();
        }
    }
    return denyForbidden(req, res, ADMIN_MESSAGE);
};


exports.authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return denyUnauthenticated(req, res);
        }

        const userRole = req.session.user.role ? String(req.session.user.role).toUpperCase() : '';
        const normalizedAllowedRoles = allowedRoles.map(role => String(role).toUpperCase());

        if (normalizedAllowedRoles.includes(userRole)) {
            return next();
        }

        const roleIdMap = {
            1: ['ADMIN'],
            2: ['STATION COMMANDER'],
            3: ['INVESTIGATING OFFICER'],
            4: ['COUNTER/INTAKE OFFICER']
        };

        const roleId = Number(req.session.user.role_id);
        const roleIdAliases = roleIdMap[roleId] || [];
        if (roleIdAliases.some(alias => normalizedAllowedRoles.includes(alias))) {
            return next();
        }

        return denyForbidden(req, res, ROLE_MESSAGE);
    };
};
