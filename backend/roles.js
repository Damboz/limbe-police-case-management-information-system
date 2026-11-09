// ============================================================
// Central role and workflow constants.
//
// Every backend file imports its role names, role IDs, workflow
// branches, case classifications and case statuses from here.
// Role strings are never hard-coded anywhere else - mismatched
// strings (for example 'SUPERVISOR' vs 'Station Commander')
// caused bugs in the past, so this module is the single source
// of truth. The frontend keeps its own copy in
// frontend/src/lib/roles.js because the two apps deploy
// separately and cannot share code.
// ============================================================


const ROLES = {
    ADMIN: 'Admin',
    POLICE_OFFICER: 'Police Officer',
    STATION_OFFICER: 'Station Officer',
    BRANCH_OFFICER: 'Branch Officer',
    PROSECUTOR: 'Prosecutor'
};


const ROLE_IDS = {
    ADMIN: 1,
    PROSECUTOR: 6,
    POLICE_OFFICER: 7,
    STATION_OFFICER: 9,
    BRANCH_OFFICER: 10
};


// Reverse lookup: role name -> role id, used by the route guards.
const ROLE_IDS_BY_NAME = Object.fromEntries(
    Object.entries(ROLE_IDS).map(([key, id]) => [ROLES[key], id])
);


// Role names from before the workflow rollout. They are mapped to
// the new canonical names so rows in existing databases and
// sessions created before the rollout keep working.
const LEGACY_ROLE_ALIASES = {
    'Station Commander': ROLES.STATION_OFFICER,
    'station commander': ROLES.STATION_OFFICER,
    supervisor: ROLES.STATION_OFFICER,
    'Investigating Officer': ROLES.POLICE_OFFICER,
    investigator: ROLES.POLICE_OFFICER,
    'Counter/Intake Officer': ROLES.POLICE_OFFICER,
    officer: ROLES.POLICE_OFFICER,
    'Branch In-charge': ROLES.BRANCH_OFFICER,
    'branch in-charge': ROLES.BRANCH_OFFICER,
    'CID Branch Officer': ROLES.BRANCH_OFFICER,
    'cid branch officer': ROLES.BRANCH_OFFICER,
    'Investigation Branch Officer': ROLES.BRANCH_OFFICER,
    'investigation branch officer': ROLES.BRANCH_OFFICER,
    'Prosecution Officer': ROLES.PROSECUTOR,
    'prosecution officer': ROLES.PROSECUTOR
};


// Legacy role ids map to the new role ids for the same reason.
const LEGACY_ROLE_ID_MAP = {
    2: ROLE_IDS.STATION_OFFICER,
    3: ROLE_IDS.POLICE_OFFICER,
    4: ROLE_IDS.POLICE_OFFICER,
    5: ROLE_IDS.BRANCH_OFFICER
};


// Workflow branches. A Branch Officer heads exactly one of these
// and only sees the cases classified into their branch.
const WORKFLOW_BRANCHES = {
    INVESTIGATION: 'Investigation Branch',
    CID: 'Criminal Investigation Department'
};


const CASE_CLASSIFICATIONS = {
    MINOR: 'Minor',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical'
};


// Classification -> workflow branch routing rule. Minor and Medium
// cases go to the Investigation Branch; High and Critical to CID.
const CLASSIFICATION_BRANCHES = {
    Minor: WORKFLOW_BRANCHES.INVESTIGATION,
    Medium: WORKFLOW_BRANCHES.INVESTIGATION,
    High: WORKFLOW_BRANCHES.CID,
    Critical: WORKFLOW_BRANCHES.CID
};


// Severity is captured when the case is registered, at the same
// time as the offence type. It is the input that decides the
// classification and the workflow branch, so the officer no longer
// classifies the case in a separate step.
const SEVERITY_LEVELS = {
    MINOR: 'Minor',
    MODERATE: 'Moderate',
    SEVERE: 'Severe',
    CRITICAL: 'Critical'
};


// Severity -> classification. Registration stores the resulting
// classification directly on the case.
const SEVERITY_CLASSIFICATIONS = {
    Minor: CASE_CLASSIFICATIONS.MINOR,
    Moderate: CASE_CLASSIFICATIONS.MEDIUM,
    Severe: CASE_CLASSIFICATIONS.HIGH,
    Critical: CASE_CLASSIFICATIONS.CRITICAL
};


// Severity -> workflow branch. Moderate cases stay with the
// Investigation Branch; Severe and Critical cases go to CID.
const SEVERITY_BRANCHES = {
    Minor: WORKFLOW_BRANCHES.INVESTIGATION,
    Moderate: WORKFLOW_BRANCHES.INVESTIGATION,
    Severe: WORKFLOW_BRANCHES.CID,
    Critical: WORKFLOW_BRANCHES.CID
};


// Severity -> priority. Priority mirrors the severity so the
// register can sort the most serious cases first.
const SEVERITY_PRIORITIES = {
    Minor: 'Low',
    Moderate: 'Medium',
    Severe: 'High',
    Critical: 'Critical'
};


// Assignment role types. Every case can carry one Investigator
// (the lead) plus one Court Standing Officer.
const ASSIGNMENT_ROLE_TYPES = {
    INVESTIGATOR: 'Investigator',
    COURT_STANDING_OFFICER: 'Court Standing Officer'
};


const ASSIGNMENT_STATUSES = {
    ACTIVE: 'Active',
    REASSIGNED: 'Reassigned',
    REMOVED: 'Removed'
};


// Normalise a free-text severity value to a canonical level.
// Returns null when the value is unknown so callers can decide
// whether to default or reject.
function severityLevel(rawSeverity) {
    const value = String(rawSeverity || '').trim().toLowerCase();
    if (!value) return null;
    return Object.values(SEVERITY_LEVELS).find(level => level.toLowerCase() === value) || null;
}


// Derive the classification for a severity level.
function classificationForSeverity(rawSeverity) {
    const level = severityLevel(rawSeverity);
    return level ? SEVERITY_CLASSIFICATIONS[level] : null;
}


// Derive the workflow branch for a severity level.
function branchForSeverity(rawSeverity) {
    const level = severityLevel(rawSeverity);
    return level ? SEVERITY_BRANCHES[level] : null;
}


// Derive the priority for a severity level.
function priorityForSeverity(rawSeverity) {
    const level = severityLevel(rawSeverity);
    return level ? SEVERITY_PRIORITIES[level] : null;
}


// Case lifecycle. A case is Registered when saved, with its OB,
// criminal number, classification and workflow branch generated
// automatically. It becomes Assigned once a Branch Officer assigns
// an investigating officer, and moves to Under Investigation when
// the officer starts recording diary entries. Submitted for Review,
// Closed and Forwarded to Prosecution follow. Court Pending and
// Archived are retained for historical cases.
const CASE_STATUSES = {
    REGISTERED: 'Registered',
    NUMBERED: 'Numbered',
    CLASSIFIED: 'Classified',
    ASSIGNED: 'Assigned',
    UNDER_INVESTIGATION: 'Under Investigation',
    SUBMITTED_FOR_REVIEW: 'Submitted for Review',
    COURT_PENDING: 'Court Pending',
    FORWARDED_TO_PROSECUTION: 'Forwarded to Prosecution',
    CLOSED: 'Closed',
    ARCHIVED: 'Archived'
};


// Canonicalize a role string coming from a session cookie or a
// database row. Unknown roles resolve to null so the guards deny
// access instead of guessing.
function canonicalRole(rawRole) {
    const role = String(rawRole || '').trim();
    if (!role) return null;
    if (Object.values(ROLES).includes(role)) return role;
    return LEGACY_ROLE_ALIASES[role] || null;
}


// Canonicalize a role id coming from a session cookie or a
// database row. Unknown ids resolve to null.
function canonicalRoleId(rawRoleId) {
    const roleId = Number(rawRoleId);
    if (!Number.isInteger(roleId)) return null;
    if (Object.values(ROLE_IDS).includes(roleId)) return roleId;
    return LEGACY_ROLE_ID_MAP[roleId] || null;
}


// True when the role carried by the session/database row matches
// any of the allowed canonical role names. Legacy role names are
// accepted so sessions created before the rollout keep working
// until the officer logs in again.
function roleIn(user, allowedRoles) {
    const canonical = canonicalRole(user && user.role);
    return Boolean(canonical) && allowedRoles.includes(canonical);
}


// True when the role id carried by the session/database row is
// one of the allowed role ids.
function roleIdIn(user, allowedRoleIds) {
    const canonical = canonicalRoleId(user && user.role_id);
    return Boolean(canonical) && allowedRoleIds.includes(canonical);
}


module.exports = {
    ROLES,
    ROLE_IDS,
    ROLE_IDS_BY_NAME,
    LEGACY_ROLE_ALIASES,
    LEGACY_ROLE_ID_MAP,
    WORKFLOW_BRANCHES,
    CASE_CLASSIFICATIONS,
    CLASSIFICATION_BRANCHES,
    SEVERITY_LEVELS,
    SEVERITY_CLASSIFICATIONS,
    SEVERITY_BRANCHES,
    SEVERITY_PRIORITIES,
    ASSIGNMENT_ROLE_TYPES,
    ASSIGNMENT_STATUSES,
    CASE_STATUSES,
    severityLevel,
    classificationForSeverity,
    branchForSeverity,
    priorityForSeverity,
    canonicalRole,
    canonicalRoleId,
    roleIn,
    roleIdIn
};
