const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');
const { ROLES } = require('../roles');


// PDF downloads stream straight to the browser, so they keep their own
// non-/api paths instead of going through the JSON API router.
// Every route's role list mirrors the operations that role performs: an
// officer reports on their own cases, the station commander on the station,
// the branch officer on their branch, the records desk on the numbering
// register, prosecutors on the prosecution caseload. Admin's only report is
// the system snapshot, because Admin's operations are personnel and audit.
router.get(
    '/reports/my-cases',
    isAuthenticated,
    authorizeRoles(ROLES.POLICE_OFFICER, ROLES.STATION_OFFICER),
    pdfController.exportMyCasesPDF
);

router.get(
    '/supervisor/reports/station-performance',
    isAuthenticated,
    authorizeRoles(ROLES.STATION_OFFICER),
    pdfController.exportStationPerformancePDF
);

router.get(
    '/supervisor/reports/crime-statistics',
    isAuthenticated,
    authorizeRoles(ROLES.STATION_OFFICER),
    pdfController.exportCrimeStatsPDF
);

router.get(
    '/supervisor/reports/officer-productivity',
    isAuthenticated,
    authorizeRoles(ROLES.STATION_OFFICER),
    pdfController.exportOfficerProductivityPDF
);

router.get(
    '/branch/reports/cases',
    isAuthenticated,
    authorizeRoles(ROLES.BRANCH_OFFICER),
    pdfController.exportBranchCasesPDF
);

router.get(
    '/records/reports/numbering',
    isAuthenticated,
    authorizeRoles(ROLES.RECORDS_OFFICER),
    pdfController.exportNumberingRegisterPDF
);

router.get(
    '/prosecution/reports/cases',
    isAuthenticated,
    authorizeRoles(ROLES.PROSECUTOR),
    pdfController.exportProsecutionCasesPDF
);

router.get(
    '/admin/reports/system',
    isAuthenticated,
    authorizeRoles(ROLES.ADMIN),
    pdfController.exportSystemReportPDF
);


module.exports = router;
