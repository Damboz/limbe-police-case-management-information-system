const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../roles');


// PDF downloads stream straight to the browser, so they keep their own
// non-/api paths instead of going through the JSON API router.
router.get(
    '/reports/my-cases',
    isAuthenticated,
    authorizeRoles(ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER, ROLES.ADMIN),
    pdfController.exportMyCasesPDF
);

router.get(
    '/supervisor/reports/station-performance',
    isAuthenticated,
    authorizeRoles(ROLES.STATION_OFFICER, ROLES.ADMIN),
    pdfController.exportStationPerformancePDF
);

router.get(
    '/supervisor/reports/crime-statistics',
    isAuthenticated,
    authorizeRoles(ROLES.STATION_OFFICER, ROLES.ADMIN),
    pdfController.exportCrimeStatsPDF
);

router.get(
    '/supervisor/reports/officer-productivity',
    isAuthenticated,
    authorizeRoles(ROLES.STATION_OFFICER, ROLES.ADMIN),
    pdfController.exportOfficerProductivityPDF
);

// Role-scoped reports. Each role gets a report built from the data they are
// responsible for: branch officers their branch, the records desk the
// numbering register, prosecutors the prosecution caseload and admins the
// system-wide snapshot.
router.get(
    '/branch/reports/cases',
    isAuthenticated,
    authorizeRoles(ROLES.BRANCH_OFFICER),
    pdfController.exportBranchCasesPDF
);

router.get(
    '/records/reports/numbering',
    isAuthenticated,
    authorizeRoles(ROLES.RECORDS_OFFICER, ROLES.ADMIN),
    pdfController.exportNumberingRegisterPDF
);

router.get(
    '/prosecution/reports/cases',
    isAuthenticated,
    authorizeRoles(ROLES.PROSECUTOR, ROLES.ADMIN),
    pdfController.exportProsecutionCasesPDF
);

router.get(
    '/admin/reports/system',
    isAuthenticated,
    authorizeRoles(ROLES.ADMIN),
    pdfController.exportSystemReportPDF
);


module.exports = router;
