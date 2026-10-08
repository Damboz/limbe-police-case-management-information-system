const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');


// PDF downloads stream straight to the browser, so they keep their own
// non-/api paths instead of going through the JSON API router.
router.get(
    '/reports/my-cases',
    isAuthenticated,
    authorizeRoles('Investigating Officer', 'Station Commander'),
    pdfController.exportMyCasesPDF
);

router.get(
    '/supervisor/reports/station-performance',
    isAuthenticated,
    authorizeRoles('Station Commander'),
    pdfController.exportStationPerformancePDF
);

router.get(
    '/supervisor/reports/crime-statistics',
    isAuthenticated,
    authorizeRoles('Station Commander'),
    pdfController.exportCrimeStatsPDF
);

router.get(
    '/supervisor/reports/officer-productivity',
    isAuthenticated,
    authorizeRoles('Station Commander'),
    pdfController.exportOfficerProductivityPDF
);


module.exports = router;
