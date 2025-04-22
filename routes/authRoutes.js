const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Email/Password Registration and Login

// Phone-based OTP endpoints
router.post('/send-otp', authController.sendOtP);
// router.post('/verify-otp', authController.verifyOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
