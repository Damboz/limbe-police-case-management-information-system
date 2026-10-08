const db = require('../config/db');
const { ok, fail } = require('../utils/result');

const EVIDENCE_CATEGORIES = ['Physical', 'Documentary', 'Digital', 'Forensic', 'Weapon', 'Other'];
const VALID_EVIDENCE_STATUSES = ['In Locker', 'Transferred to Lab', 'Presented in Court', 'Returned', 'Disposed'];
const SUPERVISOR_ROLES = ['Station Commander', 'Admin'];


function canManage(user) {
    return SUPERVISOR_ROLES.includes(user.role);
}


async function getLedger(user, query) {
    const filters = {
        status: query.status || '',
        category: query.category || '',
        q: (query.q || '').trim(),
        from: query.from || '',
        to: query.to || ''
    };

    const scoped = !canManage(user);
    const scopeConditions = scoped ? ['c.id IN (SELECT ci.case_id FROM case_investigators ci WHERE ci.investigator_id = ?)'] : [];
    const scopeParams = scoped ? [user.id] : [];

    const filterConditions = [];
    const filterParams = [];
    if (filters.status) {
        filterConditions.push('e.status = ?');
        filterParams.push(filters.status);
    }
    if (filters.category) {
        filterConditions.push('e.category = ?');
        filterParams.push(filters.category);
    }
    if (filters.q) {
        filterConditions.push('(e.item_number LIKE ? OR e.description LIKE ? OR e.storage_location LIKE ? OR c.ob_number LIKE ?)');
        const like = `%${filters.q}%`;
        filterParams.push(like, like, like, like);
    }
    if (filters.from) {
        filterConditions.push('DATE(e.collected_at) >= ?');
        filterParams.push(filters.from);
    }
    if (filters.to) {
        filterConditions.push('DATE(e.collected_at) <= ?');
        filterParams.push(filters.to);
    }

    const scopeWhere = ['1=1', ...scopeConditions].filter(Boolean).join(' AND ');
    const fullWhere = ['1=1', ...scopeConditions, ...filterConditions].filter(Boolean).join(' AND ');
    const listParams = [...scopeParams, ...filterParams];

    const [[kpi]] = await db.execute(`
        SELECT 
            COUNT(*) AS total_items,
            SUM(CASE WHEN e.status = 'In Locker' THEN 1 ELSE 0 END) AS in_locker,
            SUM(CASE WHEN e.status = 'Transferred to Lab' THEN 1 ELSE 0 END) AS transferred,
            SUM(CASE WHEN e.status = 'Presented in Court' THEN 1 ELSE 0 END) AS in_court,
            SUM(CASE WHEN e.status = 'Returned' THEN 1 ELSE 0 END) AS returned,
            SUM(CASE WHEN e.status = 'Disposed' THEN 1 ELSE 0 END) AS disposed,
            COUNT(DISTINCT e.case_id) AS tracked_cases
        FROM evidence e
        JOIN cases c ON e.case_id = c.id
        WHERE ${scopeWhere}
    `, scopeParams);

    const [statusOptions] = await db.execute(`
        SELECT DISTINCT e.status
        FROM evidence e
        JOIN cases c ON e.case_id = c.id
        WHERE ${scopeWhere} AND e.status IS NOT NULL AND e.status != ''
        ORDER BY e.status
    `, scopeParams);

    const [categoryOptions] = await db.execute(`
        SELECT DISTINCT e.category
        FROM evidence e
        JOIN cases c ON e.case_id = c.id
        WHERE ${scopeWhere} AND e.category IS NOT NULL AND e.category != ''
        ORDER BY e.category
    `, scopeParams);

    const [evidenceItems] = await db.execute(`
        SELECT 
            e.id,
            e.case_id,
            e.item_number,
            e.description,
            e.category,
            e.storage_location,
            e.collected_at,
            e.status,
            c.ob_number,
            c.incident_location,
            cc.name AS crime_category,
            CONCAT(u.rank_title, ' ', u.first_name, ' ', u.last_name) AS collected_by_name
        FROM evidence e
        JOIN cases c ON e.case_id = c.id
        LEFT JOIN crime_categories cc ON c.category_id = cc.id
        LEFT JOIN users u ON e.collected_by_officer_id = u.id
        WHERE ${fullWhere}
        ORDER BY e.collected_at DESC
        LIMIT 300
    `, listParams);

    const categories = [...new Set([...EVIDENCE_CATEGORIES, ...categoryOptions.map(o => o.category)])];

    return ok({
        role: user.role,
        kpi: {
            totalItems: kpi.total_items || 0,
            inLocker: kpi.in_locker || 0,
            transferred: kpi.transferred || 0,
            inCourt: kpi.in_court || 0,
            returned: kpi.returned || 0,
            disposed: kpi.disposed || 0,
            trackedCases: kpi.tracked_cases || 0
        },
        evidenceItems,
        filters,
        statusOptions: statusOptions.map(o => o.status),
        categories,
        validStatuses: VALID_EVIDENCE_STATUSES,
        canUpdateStatus: canManage(user)
    });
}


async function findEvidenceItem(id) {
    const [rows] = await db.execute(`
        SELECT e.id, e.item_number, e.status, e.case_id, e.storage_location, c.ob_number
        FROM evidence e
        JOIN cases c ON e.case_id = c.id
        WHERE e.id = ?
    `, [id]);
    return rows[0] || null;
}


async function updateStatus(user, id, newStatus, notes) {
    if (!canManage(user)) {
        return fail(403, 'Only Supervisors and Administrators can update evidence status.');
    }

    if (!VALID_EVIDENCE_STATUSES.includes(newStatus)) {
        return fail(400, 'Invalid evidence status.');
    }

    const evidence = await findEvidenceItem(id);
    if (!evidence) {
        return fail(404, 'Evidence item not found.');
    }

    const oldStatus = evidence.status;

    await db.execute('UPDATE evidence SET status = ? WHERE id = ?', [newStatus, id]);

    return ok({
        itemNumber: evidence.item_number,
        obNumber: evidence.ob_number,
        oldStatus,
        newStatus,
        auditDetails: `Evidence item "${evidence.item_number}" (Case OB ${evidence.ob_number}) status changed from "${oldStatus}" to "${newStatus}".${notes ? ' Notes: ' + notes : ''}`
    });
}


async function transfer(user, id, transferTo, transferNotes) {
    if (!canManage(user)) {
        return fail(403, 'Only Supervisors and Administrators can transfer evidence.');
    }

    if (!transferTo || !transferTo.trim()) {
        return fail(400, 'Transfer destination is required.');
    }

    const evidence = await findEvidenceItem(id);
    if (!evidence) {
        return fail(404, 'Evidence item not found.');
    }

    const destination = transferTo.trim();
    const oldLocation = evidence.storage_location;

    await db.execute(
        `UPDATE evidence SET storage_location = ?, status = 'Transferred to Lab' WHERE id = ?`,
        [destination, id]
    );

    return ok({
        itemNumber: evidence.item_number,
        obNumber: evidence.ob_number,
        destination,
        auditDetails: `Evidence item "${evidence.item_number}" (Case OB ${evidence.ob_number}) transferred from "${oldLocation}" to "${destination}".${transferNotes ? ' Notes: ' + transferNotes : ''}`
    });
}


async function dispose(user, id, disposalReason) {
    if (!canManage(user)) {
        return fail(403, 'Only Supervisors and Administrators can dispose evidence.');
    }

    if (!disposalReason || !disposalReason.trim()) {
        return fail(400, 'Disposal reason is required for audit purposes.');
    }

    const evidence = await findEvidenceItem(id);
    if (!evidence) {
        return fail(404, 'Evidence item not found.');
    }

    const reason = disposalReason.trim();

    await db.execute(`UPDATE evidence SET status = 'Disposed' WHERE id = ?`, [id]);

    return ok({
        itemNumber: evidence.item_number,
        obNumber: evidence.ob_number,
        reason,
        auditDetails: `Evidence item "${evidence.item_number}" (Case OB ${evidence.ob_number}) disposed. Reason: ${reason}`
    });
}


module.exports = {
    EVIDENCE_CATEGORIES,
    VALID_EVIDENCE_STATUSES,
    getLedger,
    updateStatus,
    transfer,
    dispose
};
