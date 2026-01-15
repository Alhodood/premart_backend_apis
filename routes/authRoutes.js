const express = require('express');
const router = express.Router();

const {
  registerUser,
  loginUser,
  updateProfile,
  updateUserAddress,
  getAllUsers,
  getAllAddresses,
  deleteAddressById,
  addNewAddress,
  getDefultAddress,
  getProfile,
  deletAddcount,
  addNewCard,
  getAllCard,
  updateUserCard,
  deleteCardById,
  sendOtpToCustomer,
  verifyOtpForCustomer,
  resendOtpToCustomer
} = require('../controllers/authController');

const adminAuthController = require('../controllers/adminAuthController');
const deliveryAgencyAuthController = require('../controllers/deliveryAgencyAuthController');

/* ============================
   BASIC AUTH (CUSTOMER)
============================ */
router.post('/register', registerUser);
router.post('/login', loginUser);

/* ============================
   PROFILE
============================ */
router.put('/profile/:userId', updateProfile);
router.get('/profile/:userId', getProfile);
router.put('/profile-delete/:userId', deletAddcount);

/* ============================
   USERS
============================ */
router.get('/getAllusers', getAllUsers);

/* ============================
   ADDRESS
============================ */
router.get('/address/:id', getAllAddresses);
router.post('/address/:id', addNewAddress);
router.put('/address/:id/:addressId', updateUserAddress);
router.delete('/address/:id/:addressId', deleteAddressById);
router.get('/defultAddress/:id', getDefultAddress);

/* ============================
   CARD
============================ */
router.get('/card/:id', getAllCard);
router.post('/card/:id', addNewCard);
router.put('/card/:id/:cardId', updateUserCard);
router.delete('/card/:id/:cardId', deleteCardById);

/* ============================
   CUSTOMER OTP
============================ */
router.post('/send-otp', sendOtpToCustomer);
router.post('/verify-otp', verifyOtpForCustomer);
router.post('/resend-otp', resendOtpToCustomer);

/* ============================
   SUPER ADMIN
============================ */
router.post('/super-admin/register', adminAuthController.registerSuperAdmin);
router.post('/super-admin/login', adminAuthController.loginSuperAdmin);
router.put('/super-admin/profile-update/:adminId', adminAuthController.updateAdminSettings);
router.get('/super-admin/settings/:adminId', adminAuthController.getSuperAdminSettings);

/* ============================
   SHOP ADMIN
============================ */
router.post('/shop-admin/register', adminAuthController.registerShopAdmin);
router.post('/shop-admin/login', adminAuthController.loginShopAdmin);
router.put('/shop/:shopId/update-details', adminAuthController.updateShopDetails);

/* ============================
   DELIVERY AGENCY
============================ */
router.post('/delivery-agency/register', deliveryAgencyAuthController.registerAgency);
router.post('/delivery-agency/login', deliveryAgencyAuthController.loginAgency);
router.put('/delivery-agency/profile/:agencyId', deliveryAgencyAuthController.updateMyProfile);
router.get('/delivery-agency/profile/:agencyId', deliveryAgencyAuthController.getMyProfile);
router.patch('/delivery-agency/password/:agencyId', deliveryAgencyAuthController.changePassword);
router.get('/delivery-agency/payments/:agencyId', deliveryAgencyAuthController.getAgencyPaymentRecords);
router.get('/delivery-agency/delivery-boys/:agencyId', deliveryAgencyAuthController.getAgencyDeliveryBoys);

module.exports = router;