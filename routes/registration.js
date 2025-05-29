const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const allowedRoles = require('../middleware/roleMiddleware');
const { registerForEvent, viewMyRegistration, checkRegistration } = require('../controllers/registrationController.js');

// Regular registration endpoint - can be used by both users and team members
router.post('/:eventId', auth, registerForEvent);

// Get my registrations - works for both users and team members
router.get('/me', auth, viewMyRegistration);

// Check if user is already registered for a specific event
router.get('/check/:eventId', auth, checkRegistration);

module.exports = router;