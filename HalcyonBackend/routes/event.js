const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const allowedRoles = require('../middleware/roleMiddleware');
const {createEvent, getAllEvents, getEventById} = require('../controllers/eventController');

router.post('/', auth, allowedRoles('admin', 'team'), createEvent);
router.get('/', getAllEvents);
router.get('/:id', getEventById);

module.exports = router;