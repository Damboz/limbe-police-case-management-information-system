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
    // Police Officers and the Records Officer land on the personal
    // dashboard (the Records Desk arrives with the numbering workflow).
    return '/dashboard';
}
