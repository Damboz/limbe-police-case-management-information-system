export function roleFlags(user) {
    const role = user ? String(user.role || '').toLowerCase() : '';
    const roleId = user ? Number(user.role_id) : null;

    return {
        isInvestigator: role === 'investigating officer' || role === 'investigator' || roleId === 3,
        isCommander: role === 'station commander' || role === 'supervisor' || roleId === 2,
        isAdmin: role === 'admin' || roleId === 1,
        isIntake: role === 'counter/intake officer' || role === 'officer' || roleId === 4
    };
}


export function homePathFor(user) {
    if (!user) return '/login';
    const { isAdmin, isCommander } = roleFlags(user);
    if (isAdmin) return '/admin/dashboard';
    if (isCommander) return '/supervisor/dashboard';
    return '/dashboard';
}
