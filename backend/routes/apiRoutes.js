const express = require('express');
const router = express.Router();

const authApi = require('../controllers/api/authApiController');
const caseApi = require('../controllers/api/caseApiController');
const evidenceApi = require('../controllers/api/evidenceApiController');
const adminApi = require('../controllers/api/adminApiController');
const supervisorApi = require('../controllers/api/supervisorApiController');
const reportsApi = require('../controllers/api/reportsApiController');
const generalApi = require('../controllers/api/generalApiController');

const { isAuthenticated, isAdmin, authorizeRoles } = require('../middleware/authMiddleware');


router.post('/auth/login', authApi.login);
router.post('/auth/logout', authApi.logout);
router.get('/auth/me', isAuthenticated, authApi.me);
router.post('/auth/change-password', isAuthenticated, authApi.changePassword);


router.get('/dashboard', isAuthenticated, generalApi.dashboard);
router.get('/my-analytics', isAuthenticated, authorizeRoles('Investigating Officer', 'Counter/Intake Officer'), reportsApi.myAnalytics);


router.get('/cases', isAuthenticated, caseApi.list);
router.get('/cases/new', isAuthenticated, caseApi.formOptions);
router.post('/cases', isAuthenticated, caseApi.create);
router.get('/cases/search', isAuthenticated, caseApi.search);
router.get('/cases/:id', isAuthenticated, caseApi.detail);
router.post('/cases/:id/notes', isAuthenticated, caseApi.addNote);
router.post('/cases/:id/request-status', isAuthenticated, caseApi.requestStatus);
router.post('/cases/:id/evidence', isAuthenticated, caseApi.addEvidence);
router.post('/cases/:id/suspects', isAuthenticated, caseApi.linkSuspect);
router.post('/cases/:id/victims', isAuthenticated, caseApi.linkVictim);
router.post(
    '/cases/:id/suspects/:suspectId/letter',
    isAuthenticated,
    reportsApi.suspectInvitation
);


router.get(
    '/evidence',
    isAuthenticated,
    authorizeRoles('Investigating Officer', 'Station Commander', 'Admin'),
    evidenceApi.ledger
);
router.post(
    '/evidence/:id/status',
    isAuthenticated,
    authorizeRoles('Investigating Officer', 'Station Commander', 'Admin'),
    evidenceApi.updateStatus
);
router.post(
    '/evidence/:id/transfer',
    isAuthenticated,
    authorizeRoles('Investigating Officer', 'Station Commander', 'Admin'),
    evidenceApi.transfer
);
router.post(
    '/evidence/:id/dispose',
    isAuthenticated,
    authorizeRoles('Investigating Officer', 'Station Commander', 'Admin'),
    evidenceApi.dispose
);


router.get('/admin/dashboard', isAuthenticated, isAdmin, adminApi.dashboard);
router.get('/admin/users', isAuthenticated, isAdmin, adminApi.users);
router.get('/admin/users/form-options', isAuthenticated, isAdmin, adminApi.formOptions);
router.post('/admin/users', isAuthenticated, isAdmin, adminApi.createUser);
router.get('/admin/users/:id', isAuthenticated, isAdmin, adminApi.editUser);
router.put('/admin/users/:id', isAuthenticated, isAdmin, adminApi.updateUser);
router.post('/admin/users/:id/reset-password', isAuthenticated, isAdmin, adminApi.resetPassword);
router.post('/admin/users/:id/toggle-status', isAuthenticated, isAdmin, adminApi.toggleStatus);
router.delete('/admin/users/:id', isAuthenticated, isAdmin, adminApi.deleteUser);
router.get('/admin/audit-logs', isAuthenticated, isAdmin, adminApi.auditLogs);
router.delete('/admin/audit-logs', isAuthenticated, isAdmin, adminApi.clearAuditLogs);


router.get('/supervisor/dashboard', isAuthenticated, authorizeRoles('Station Commander', 'Admin'), supervisorApi.dashboard);
router.post('/supervisor/cases/assign', isAuthenticated, authorizeRoles('Station Commander', 'Admin'), supervisorApi.assignCase);
router.post('/supervisor/cases/approve-status', isAuthenticated, authorizeRoles('Station Commander', 'Admin'), supervisorApi.approveStatus);
router.get('/supervisor/analytics', isAuthenticated, authorizeRoles('Station Commander', 'Admin'), supervisorApi.analytics);
router.get('/supervisor/analytics/hotspots', isAuthenticated, authorizeRoles('Station Commander', 'Admin'), supervisorApi.hotspots);
router.get('/supervisor/analytics/categories', isAuthenticated, authorizeRoles('Station Commander', 'Admin'), supervisorApi.categories);


module.exports = router;
