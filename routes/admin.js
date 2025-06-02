const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const allowedRoles = require('../middleware/roleMiddleware');
const {
    getAllUsers,
    getAllRegistrations,
    generatePdf,
    generateJudgePdf,
    generateJudgePdfWithPDFKit,
    deleteEvent,
    editEvent,
    exportRegistrationsToExcel,
    exportSingleEventToExcel,
    toggleEventRegistration,
    deleteRegistration,
    sendBulkRegistrationEmails
} = require('../controllers/adminController');


router.get('/users', auth, allowedRoles('admin'), getAllUsers);
router.get('/registrations', auth, allowedRoles('admin'), getAllRegistrations);
router.get('/pdf/:eventID', auth, allowedRoles('admin'), generatePdf);
router.get('/judge-pdf/:eventID', auth, allowedRoles('admin'), generateJudgePdf);
router.get('/judge-pdf-pdfkit/:eventID', auth, allowedRoles('admin'), generateJudgePdfWithPDFKit); // New production-compatible route
router.get('/excel', auth, allowedRoles('admin'), exportRegistrationsToExcel);
router.get('/excel/:eventId', auth, allowedRoles('admin'), exportSingleEventToExcel);
router.delete('/event/:id', auth, allowedRoles('admin'), deleteEvent);
router.put('/event/:id', auth, allowedRoles('admin'), editEvent);
router.patch('/event/:eventId/toggle-registration', auth, allowedRoles('admin'), toggleEventRegistration);
router.delete('/registration/:id', auth, allowedRoles('admin'), deleteRegistration);
router.post('/send-bulk-registration-emails/:eventID',sendBulkRegistrationEmails);
module.exports = router;