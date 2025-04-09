const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Email/Password Registration and Login
router.post('/register', authController.register);
router.post('/login', authController.login);

// Phone-based OTP endpoints
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
