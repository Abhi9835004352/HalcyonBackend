const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const allowedRoles = require('../middleware/roleMiddleware');
const {
    getAllUsers,
    getAllRegistrations,
    generatePdf,
    deleteEvent,
    editEvent,
    exportRegistrationsToExcel,
    toggleEventRegistration,
    deleteRegistration,
} = require('../controllers/adminController');


router.get('/users', auth, allowedRoles('admin'), getAllUsers);
router.get('/registrations', auth, allowedRoles('admin'), getAllRegistrations);
router.get('/pdf/:eventID', auth, allowedRoles('admin'), generatePdf);
router.get('/excel', auth, allowedRoles('admin'), exportRegistrationsToExcel);
router.delete('/event/:id', auth, allowedRoles('admin'), deleteEvent);
router.put('/event/:id', auth, allowedRoles('admin'), editEvent);
router.patch('/event/:eventId/toggle-registration', auth, allowedRoles('admin'), toggleEventRegistration);
router.delete('/registration/:id', auth, allowedRoles('admin'), deleteRegistration);
module.exports = router;