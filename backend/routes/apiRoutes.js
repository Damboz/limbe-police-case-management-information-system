const express = require('express');
const router = express.Router();

const authApi = require('../controllers/api/authApiController');
const caseApi = require('../controllers/api/caseApiController');
const evidenceApi = require('../controllers/api/evidenceApiController');
const adminApi = require('../controllers/api/adminApiController');
const supervisorApi = require('../controllers/api/supervisorApiController');
const branchApi = require('../controllers/api/branchApiController');
const prosecutorApi = require('../controllers/api/prosecutorApiController');
const recordsApi = require('../controllers/api/recordsApiController');
const reportsApi = require('../controllers/api/reportsApiController');
const generalApi = require('../controllers/api/generalApiController');

const { isAuthenticated, isAdmin, denyAdmin, authorizeRoles } = require('../middleware/authMiddleware');
const {
    ROLES
} = require('../roles');


router.post('/auth/login', authApi.login);
router.post('/auth/logout', authApi.logout);
router.post('/auth/forgot-password', authApi.forgotPassword);
router.post('/auth/reset-password', authApi.resetPassword);
router.get('/auth/me', isAuthenticated, authApi.me);
router.post('/auth/change-password', isAuthenticated, authApi.changePassword);


router.get('/dashboard', isAuthenticated, generalApi.dashboard);
router.get('/my-analytics', isAuthenticated, authorizeRoles(ROLES.POLICE_OFFICER), reportsApi.myAnalytics);


router.get('/cases', isAuthenticated, denyAdmin, caseApi.list);
router.get('/cases/new', isAuthenticated, denyAdmin, caseApi.formOptions);
router.post('/cases', isAuthenticated, denyAdmin, caseApi.create);
router.get('/cases/search', isAuthenticated, denyAdmin, caseApi.search);
router.get('/cases/:id', isAuthenticated, denyAdmin, caseApi.detail);
router.post('/cases/:id/notes', isAuthenticated, denyAdmin, caseApi.addNote);
router.post('/cases/:id/request-status', isAuthenticated, denyAdmin, caseApi.requestStatus);
router.post('/cases/:id/external-reports', isAuthenticated, denyAdmin, caseApi.requestExternalReport);
router.post('/cases/:id/evidence', isAuthenticated, denyAdmin, caseApi.addEvidence);
router.post('/cases/:id/suspects', isAuthenticated, denyAdmin, caseApi.linkSuspect);
router.post('/cases/:id/victims', isAuthenticated, denyAdmin, caseApi.linkVictim);
router.post(
    '/cases/:id/suspects/:suspectId/letter',
    isAuthenticated,
    denyAdmin,
    reportsApi.suspectInvitation
);


router.get(
    '/evidence',
    isAuthenticated,
    authorizeRoles(ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER),
    evidenceApi.ledger
);
router.post(
    '/evidence/:id/status',
    isAuthenticated,
    authorizeRoles(ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER),
    evidenceApi.updateStatus
);
router.post(
    '/evidence/:id/transfer',
    isAuthenticated,
    authorizeRoles(ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER),
    evidenceApi.transfer
);
router.post(
    '/evidence/:id/dispose',
    isAuthenticated,
    authorizeRoles(ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER),
    evidenceApi.dispose
);


router.get('/admin/dashboard', isAuthenticated, isAdmin, adminApi.dashboard);
router.get('/admin/users', isAuthenticated, isAdmin, adminApi.users);
router.get('/admin/users/form-options', isAuthenticated, isAdmin, adminApi.formOptions);
router.post('/admin/users', isAuthenticated, isAdmin, adminApi.createUser);
router.get('/admin/users/:id', isAuthenticated, isAdmin, adminApi.editUser);
router.put('/admin/users/:id', isAuthenticated, isAdmin, adminApi.updateUser);
router.post('/admin/users/:id/toggle-status', isAuthenticated, isAdmin, adminApi.toggleStatus);
router.delete('/admin/users/:id', isAuthenticated, isAdmin, adminApi.deleteUser);
router.get('/admin/audit-logs', isAuthenticated, isAdmin, adminApi.auditLogs);
router.delete('/admin/audit-logs', isAuthenticated, isAdmin, adminApi.clearAuditLogs);


router.get('/supervisor/dashboard', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.dashboard);
router.post('/supervisor/cases/:id/classify', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.classifyCase);
router.post('/supervisor/cases/assign', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.assignCase);
router.post('/supervisor/cases/approve-status', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.approveStatus);
router.post('/supervisor/cases/:id/resolve-query', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.resolveQuery);
router.post('/supervisor/reassign-proposals/:id/decide', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.decideReassignment);
router.get('/supervisor/analytics', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.analytics);
router.get('/supervisor/analytics/hotspots', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.hotspots);
router.get('/supervisor/analytics/categories', isAuthenticated, authorizeRoles(ROLES.STATION_OFFICER), supervisorApi.categories);


router.get('/branch/dashboard', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.dashboard);
router.post('/branch/cases/assign', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.assignCase);
router.post('/branch/cases/:id/review', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.reviewCase);
router.post('/branch/cases/:id/reassign-proposal', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.proposeReassignment);
router.post('/branch/cases/:id/external-reports', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.requestExternalReport);
router.post('/branch/external-reports/:reportId/received', isAuthenticated, authorizeRoles(ROLES.BRANCH_OFFICER), branchApi.markReportReceived);


router.get('/records/dashboard', isAuthenticated, authorizeRoles(ROLES.RECORDS_OFFICER), recordsApi.dashboard);
router.post('/records/cases/:id/numbers', isAuthenticated, authorizeRoles(ROLES.RECORDS_OFFICER), recordsApi.assignNumbers);


router.get('/prosecution/dashboard', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.dashboard);
router.post('/prosecution/cases/:id/acknowledge', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.acknowledge);
router.post('/prosecution/cases/:id/file-location', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.fileLocation);
router.post('/prosecution/cases/:id/court', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.court);
router.post('/prosecution/cases/:id/query', isAuthenticated, authorizeRoles(ROLES.PROSECUTOR), prosecutorApi.query);


module.exports = router;
