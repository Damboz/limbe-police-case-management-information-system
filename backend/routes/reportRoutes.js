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


module.exports = router;
