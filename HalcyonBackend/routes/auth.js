const express = require('express');
const router = express.Router();
const { register, login, getCurrentUser, deleteUser } = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const allowedRoles = require('../middleware/roleMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getCurrentUser);
router.delete('/user/:id', auth, allowedRoles('admin'), deleteUser);

module.exports = router;