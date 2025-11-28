const express = require('express');
const {
    register,
    login,
    logout,
    getMe,
    updatePassword,
} = require('../controllers/authController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.post('/register', protect, authorize('admin'), register);
router.post('/login', login);
router.get('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, updatePassword);

module.exports = router;
