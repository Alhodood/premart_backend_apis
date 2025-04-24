const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const adminAuthController = require('../controllers/adminAuthController');


// Email/Password Registration and Login

// Phone-based OTP endpoints
router.post('/send-otp', authController.sendOtP);
// router.post('/verify-otp', authController.verifyOtp);
router.post('/user/register', authController.register);
router.post('/user/login', authController.login);


// SHOP or AGENCY ROUTES
router.post('/admin/register', adminAuthController.register);
router.post('/admin/login', adminAuthController.shopAdminLogin);

//   SUPER ADMIN ROUTES
router.post('/superAdmin/register', adminAuthController.register);
router.post('/superAdmin/login', adminAuthController.superAdminLogin);

module.exports = router;
