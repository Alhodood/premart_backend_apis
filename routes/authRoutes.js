const express = require('express');
const { register, login, sendOtp, verifyOtp,resendOtp } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// Example protected route
router.get('/admin-only', protect, allowRoles('superAdmin'), (req, res) => {
  res.json({ message: 'Welcome, Super Admin!' });
});


//OTP LOGIN AND REGISTER through twilio



router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);


module.exports = router;