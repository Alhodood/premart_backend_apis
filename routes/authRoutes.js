const express = require('express');
const router = express.Router();

const rbacAuth = require('../controllers/rbacAuthController');

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
  verifyOtpToCustomer,
  resendOtpToCustomer
} = require('../controllers/_deprecated/authController');

const adminAuthController = require('../controllers/_deprecated/adminAuthController');
const deliveryAgencyAuthController = require('../controllers/_deprecated/deliveryAgencyAuthController');

const { protect, mustBeOwner } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../constants/roles');
const superAdminSettingsController = require('../controllers/superAdminSettingsController');


// ==========================
// PUBLIC AUTH (RBAC)
// ==========================
// Email verification flow: 1) send-verification → 2) verify → account created
router.post('/register/send-verification', rbacAuth.sendRegistrationVerification);
router.post('/register/verify', rbacAuth.verifyEmailAndRegister);
router.post('/register', rbacAuth.register);
router.post('/login', rbacAuth.login);
router.post('/verify-otp', rbacAuth.verifyOtp);
router.post('/send-otp', rbacAuth.sendOtp);
router.get('/getUsers',rbacAuth.getAllCustomers
);
router.patch('/visibility/:userId', rbacAuth.toggleAccountVisibility);
router.post('/logoutDeliveryBoy', rbacAuth.logoutDeliveryBoy);

router.post('/forgot-password', rbacAuth.forgotPassword);
router.post('/reset-password', rbacAuth.resetPassword);

router.post('/shop-admin/register', rbacAuth.registerShopAdmin);
router.post('/agency/register', rbacAuth.registerAgency);

router.post('/bootstrap/super-admin', rbacAuth.createSuperAdmin);
router.post(
  '/super-admin/create-shop-admin',
  rbacAuth.createShopAdmin
);

router.post(
  '/super-admin/create-agency',
  rbacAuth.createAgency
);
// ==========================
// PROFILE (Customer only)
// ==========================
router.get(
  '/profile/:userId',
  getProfile
);

router.get(
  '/customer/:userId/orders',
  rbacAuth.getCustomerOrders
);

router.get(
  '/customer/:userId',
  rbacAuth.getCustomerDetailsById
);

router.put(
  '/profile/:userId',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('userId'),
  updateProfile
);

router.put(
  '/profile-delete/:userId',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('userId'),
  deletAddcount
);


// ==========================
// USERS (Super Admin only)
// ==========================
router.get(
  '/getAllusers',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  getAllUsers
);


// ==========================
// ADDRESS (Customer only)
// ==========================
router.get(
  '/address/:id',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('id'),
  getAllAddresses
);

router.post(
  '/address/:id',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('id'),
  addNewAddress
);

router.put(
  '/address/:id/:addressId',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('id'),
  updateUserAddress
);

router.delete(
  '/address/:id/:addressId',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('id'),
  deleteAddressById
);

router.get(
  '/defultAddress/:id',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('id'),
  getDefultAddress
);


// ==========================
// CARD (Customer only)
// ==========================
router.get(
  '/card/:id',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('id'),
  getAllCard
);

router.post(
  '/card/:id',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('id'),
  addNewCard
);

router.put(
  '/card/:id/:cardId',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('id'),
  updateUserCard
);

router.delete(
  '/card/:id/:cardId',
  protect,
  authorize(ROLES.CUSTOMER),
  mustBeOwner('id'),
  deleteCardById
);


// ==========================
// SUPER ADMIN
// ==========================
router.put(
  '/super-admin/profile-update/:adminId',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  mustBeOwner('adminId'),
  adminAuthController.updateAdminSettings
);

router.get(
  '/super-admin/settings/:adminId',
  protect,
  adminAuthController.getSuperAdminSettings
);


// ==========================
// SHOP ADMIN
// ==========================
router.put(
  '/shop/:shopId/update-details',
  adminAuthController.updateShopDetails
);


// ==========================
// DELIVERY AGENCY
// ==========================
router.put(
  '/delivery-agency/profile/:agencyId',
  protect,
  authorize(ROLES.AGENCY),
  mustBeOwner('agencyId'),
  deliveryAgencyAuthController.updateMyProfile
);

router.get(
  '/delivery-agency/profile/:agencyId',
  protect,
  authorize(ROLES.AGENCY),
  mustBeOwner('agencyId'),
  deliveryAgencyAuthController.getMyProfile
);

router.patch(
  '/delivery-agency/password/:agencyId',
  protect,
  authorize(ROLES.AGENCY),
  mustBeOwner('agencyId'),
  deliveryAgencyAuthController.changePassword
);

router.get(
  '/delivery-agency/payments/:agencyId',
  protect,
  authorize(ROLES.AGENCY),
  mustBeOwner('agencyId'),
  deliveryAgencyAuthController.getAgencyPaymentRecords
);

router.get(
  '/delivery-agency/delivery-boys/:agencyId',
  protect,
  authorize(ROLES.AGENCY),
  mustBeOwner('agencyId'),
  deliveryAgencyAuthController.getAgencyDeliveryBoys
);

module.exports = router;