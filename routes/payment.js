const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { createOrder, verifyPayment } = require('../controllers/paymentController');

// Create payment order
router.post('/create-order/:eventId', auth, createOrder);

// Verify payment
router.post('/verify', auth, verifyPayment);

module.exports = router;