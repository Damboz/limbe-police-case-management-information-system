// Frontend copy of the backend role constants
// (backend/roles.js). The two apps deploy separately and
// cannot share code, so the names and ids are mirrored here.
// Role strings are never hard-coded anywhere else in the app.

export const ROLES = {
    ADMIN: 'Admin',
    POLICE_OFFICER: 'Police Officer',
    RECORDS_OFFICER: 'Records Officer',
    STATION_OFFICER: 'Station Officer',
    BRANCH_OFFICER: 'Branch Officer',
    PROSECUTOR: 'Prosecutor'
};

export const ROLE_IDS = {
    ADMIN: 1,
    PROSECUTOR: 6,
    POLICE_OFFICER: 7,
    RECORDS_OFFICER: 8,
    STATION_OFFICER: 9,
    BRANCH_OFFICER: 10
};

// Reverse lookup: role name -> role id.
export const ROLE_IDS_BY_NAME = Object.fromEntries(
    Object.entries(ROLE_IDS).map(([key, id]) => [ROLES[key], id])
);

// Role names from before the workflow rollout, mapped to the
// new canonical names so older sessions keep working.
const LEGACY_ROLE_ALIASES = {
    'station commander': ROLES.STATION_OFFICER,
    supervisor: ROLES.STATION_OFFICER,
    'investigating officer': ROLES.POLICE_OFFICER,
    investigator: ROLES.POLICE_OFFICER,
    'counter/intake officer': ROLES.POLICE_OFFICER,
    officer: ROLES.POLICE_OFFICER,
    'branch in-charge': ROLES.BRANCH_OFFICER,
    branch: ROLES.BRANCH_OFFICER,
    'cid branch officer': ROLES.BRANCH_OFFICER,
    'cid officer': ROLES.BRANCH_OFFICER,
    'investigation branch officer': ROLES.BRANCH_OFFICER,
    'investigation officer': ROLES.BRANCH_OFFICER,
    'prosecution officer': ROLES.PROSECUTOR
};

const LEGACY_ROLE_ID_MAP = {
    2: ROLE_IDS.STATION_OFFICER,
    3: ROLE_IDS.POLICE_OFFICER,
    4: ROLE_IDS.POLICE_OFFICER,
    5: ROLE_IDS.BRANCH_OFFICER
};

export function canonicalRole(user) {
    const role = String((user && user.role) || '').trim();
    if (!role) return null;
    if (Object.values(ROLES).includes(role)) return role;
    return LEGACY_ROLE_ALIASES[role.toLowerCase()] || null;
}

export function canonicalRoleId(user) {
    const roleId = Number(user && user.role_id);
    if (!Number.isInteger(roleId)) return null;
    if (Object.values(ROLE_IDS).includes(roleId)) return roleId;
    return LEGACY_ROLE_ID_MAP[roleId] || null;
}

export function roleFlags(user) {
    const role = canonicalRole(user);
    const roleId = canonicalRoleId(user);

    return {
        isPoliceOfficer: role === ROLES.POLICE_OFFICER || roleId === ROLE_IDS.POLICE_OFFICER,
        isRecordsOfficer: role === ROLES.RECORDS_OFFICER || roleId === ROLE_IDS.RECORDS_OFFICER,
        isStationOfficer: role === ROLES.STATION_OFFICER || roleId === ROLE_IDS.STATION_OFFICER,
        isBranchOfficer: role === ROLES.BRANCH_OFFICER || roleId === ROLE_IDS.BRANCH_OFFICER,
        isProsecutor: role === ROLES.PROSECUTOR || roleId === ROLE_IDS.PROSECUTOR,
        isAdmin: role === ROLES.ADMIN || roleId === ROLE_IDS.ADMIN
    };
}

export function homePathFor(user) {
    if (!user) return '/login';
    const { isAdmin, isStationOfficer, isBranchOfficer, isProsecutor } = roleFlags(user);
    if (isAdmin) return '/admin/dashboard';
    if (isStationOfficer) return '/supervisor/dashboard';
    if (isBranchOfficer) return '/branch/dashboard';
    if (isProsecutor) return '/prosecution/dashboard';
    return '/dashboard';
}

// Which roles may open each guarded section. Mirrors the route guards in
// App.jsx so the post-login redirect can validate a remembered deep link
// before sending the user to it; otherwise a role that lacks access lands
// straight on the 403 page instead of its dashboard.
export const ROUTE_ROLES = {
    MY_ANALYTICS: [ROLES.POLICE_OFFICER],
    CASES: [ROLES.POLICE_OFFICER, ROLES.RECORDS_OFFICER, ROLES.STATION_OFFICER, ROLES.BRANCH_OFFICER, ROLES.PROSECUTOR],
    EVIDENCE: [ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER],
    SUPERVISOR: [ROLES.STATION_OFFICER],
    BRANCH: [ROLES.BRANCH_OFFICER],
    PROSECUTION: [ROLES.PROSECUTOR],
    ADMIN: [ROLES.ADMIN]
};

// Sections any signed-in user may open.
const OPEN_PATH_PREFIXES = ['/dashboard', '/change-password'];

const GUARDED_PATH_ROLES = [
    { prefix: '/my-analytics', roles: ROUTE_ROLES.MY_ANALYTICS },
    { prefix: '/cases', roles: ROUTE_ROLES.CASES },
    { prefix: '/evidence', roles: ROUTE_ROLES.EVIDENCE },
    { prefix: '/supervisor', roles: ROUTE_ROLES.SUPERVISOR },
    { prefix: '/branch', roles: ROUTE_ROLES.BRANCH },
    { prefix: '/prosecution', roles: ROUTE_ROLES.PROSECUTION },
    { prefix: '/admin', roles: ROUTE_ROLES.ADMIN }
];

function matchesPrefix(pathname, prefix) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canAccessPath(user, pathname) {
    if (!user) return false;

    const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';

    if (OPEN_PATH_PREFIXES.some(prefix => matchesPrefix(path, prefix))) return true;

    const rule = GUARDED_PATH_ROLES.find(route => matchesPrefix(path, route.prefix));
    if (!rule) return false;

    const role = canonicalRole(user);
    const roleId = canonicalRoleId(user);

    const roleMatches = Boolean(role) && rule.roles.includes(role);
    const idMatches = roleId !== null && rule.roles.some(name => ROLE_IDS_BY_NAME[name] === roleId);

    return roleMatches || idMatches;
}
