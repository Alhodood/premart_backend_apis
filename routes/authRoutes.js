const express = require('express');
const { registerUser, loginUser, sendOtp, verifyOtp,resendOtp,updateProfile,
    updateUserAddress,getAllAddresses,deleteAddressById,addNewAddress,getDefultAddress,getProfile,deletAddcount,
    addNewCard, getAllCard,updateUserCard,deleteCardById } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const adminAuthController = require('../controllers/adminAuthController');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.put('/profile/:userId',updateProfile);
router.get('/profile/:userId',getProfile);

router.put('/profile-delete/:userId',deletAddcount);


router.get("/address/:id",getAllAddresses);
router.post("/address/:id",addNewAddress);
router.put("/address/:id/:addressId",updateUserAddress);
router.delete("/address/:id/:addressId",deleteAddressById);
router.get("/defultAddress/:id",getDefultAddress);


router.get("/card/:id",getAllCard);
router.post("/card/:id",addNewCard);
router.put("/card/:id/:cardId",updateUserCard);
router.delete("/card/:id/:cardId",deleteCardById);



// Super Admin
router.post('/super-admin/register', adminAuthController.registerSuperAdmin);
router.post('/super-admin/login', adminAuthController.loginSuperAdmin);

// Shop Admin
router.post('/shop-admin/register', adminAuthController.registerShopAdmin);
router.post('/shop-admin/login', adminAuthController.loginShopAdmin);



// Example protected route
// router.get('/admin-only', protect, allowRoles('superAdmin'), (req, res) => {
//   res.json({ message: 'Welcome, Super Admin!' });
// });


//OTP LOGIN AND REGISTER through twilio

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
//router.post('/sendOtpOnly', sendOtpOnly);


module.exports = router;