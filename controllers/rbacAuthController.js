const jwt = require('jsonwebtoken');
const roleModelMap = require('../constants/roleModelMap');
const { linkDeviceToUser } = require('./deviceController');
const { Shop } = require('../models/Shop');
const { ROLES } = require('../constants/roles');
const User = require('../models/User');
const DeliveryBoy = require('../models/DeliveryBoy');
const crypto = require('crypto');
const { sendGreetings, sendPasswordResetOtp, sendRegisterOtp } = require('../helper/mailHelper');
const EmailVerification = require('../models/EmailVerification');
const { sendOTPEmail, sendDeliveryBoyWelcomeEmail } = require('../services/emailService');
const { ShopAdmin, SuperAdmin } = require('../models/AdminAuth');
const { notifyShopVerification, notifyAgencyVerification, notifyRegistrationRequest } = require('./bellNotifications');
const logger = require('../config/logger'); // ← only addition at top

const OTP_EXPIRY_MINUTES = 15;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = '7d';

const generateToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
function generateOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, dob, phone, password, countryCode, role, latitude, longitude, agencyId, emiratesId, areaAssigned, licenseNo, city, profileImage, licenseImage } = req.body;

    if (!phone || !password || !countryCode) {
      return res.status(400).json({ success: false, message: 'Phone, password, and country code are required' });
    }

    if (role === ROLES.DELIVERY_BOY) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: 'Latitude and longitude are required for delivery boy registration' });
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ success: false, message: 'Latitude and longitude must be numbers' });
      }
      if (agencyId) {
        const { DeliveryAgency } = require('../models/DeliveryAgency');
        const agencyExists = await DeliveryAgency.findById(agencyId);
        if (!agencyExists) return res.status(404).json({ success: false, message: 'Invalid agency ID' });
      }
    }

    let existingUser;
    if (role === ROLES.CUSTOMER) existingUser = await User.findOne({ phone });
    else if (role === ROLES.DELIVERY_BOY) existingUser = await DeliveryBoy.findOne({ phone });
    else if (role === ROLES.SHOP_ADMIN) existingUser = await ShopAdmin.findOne({ phone });
    if (existingUser) return res.status(400).json({ success: false, message: 'User with this phone number already exists' });

    let newUser;
    if (role === ROLES.CUSTOMER) {
      newUser = await User.create({ name, email, dob, phone, password, countryCode, role: ROLES.CUSTOMER });
    } else if (role === ROLES.DELIVERY_BOY) {
      newUser = await DeliveryBoy.create({
        name: name || 'New Delivery Boy', email, phone, password, countryCode, dob,
        licenseNo, emiratesId, profileImage, licenseImage, areaAssigned, city,
        latitude, longitude, availability: true, isOnline: false, accountVerify: false,
        assignedOrders: [], role: ROLES.DELIVERY_BOY, agencyId: agencyId || null
      });
      if (newUser.email) {
        sendDeliveryBoyWelcomeEmail(newUser.email, newUser.name, newUser.phone)
          .then(sent => { if (!sent) logger.warn('Welcome email failed for delivery boy', { email: newUser.email }); }) // ← replaced console.warn
          .catch(e => logger.warn('Welcome email error for delivery boy', { email: newUser.email, error: e.message })); // ← replaced console.warn
      }
    } else if (role === ROLES.SHOP_ADMIN) {
      newUser = await ShopAdmin.create({ name, email, dob, phone, password, countryCode, role: ROLES.SHOP_ADMIN });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    if (newUser.email) {
      sendGreetings(newUser.email, newUser.name || newUser.agencyDetails?.name)
        .then((r) => { if (!r.sent) logger.warn('Welcome email skipped', { email: newUser.email, error: r.error }); }) // ← replaced console.warn
        .catch((e) => logger.warn('Welcome email error', { email: newUser.email, error: e.message })); // ← replaced console.warn
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        userId: newUser._id, name: newUser.name, phone: newUser.phone,
        email: newUser.email, dob: newUser.dob != null ? newUser.dob : null, role: newUser.role,
        ...(role === ROLES.DELIVERY_BOY && {
          emiratesId: newUser.emiratesId, licenseNo: newUser.licenseNo,
          areaAssigned: newUser.areaAssigned, city: newUser.city,
          profileImage: newUser.profileImage, licenseImage: newUser.licenseImage,
          location: { latitude: newUser.latitude, longitude: newUser.longitude }
        })
      }
    });
  } catch (err) {
    logger.error('register failed', { role: req.body.role, phone: req.body.phone, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Registration failed', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL VERIFICATION FLOW
// ─────────────────────────────────────────────────────────────────────────────
exports.sendRegistrationVerification = async (req, res) => {
  try {
    const { name, email, dob, phone, password, countryCode, role, latitude, longitude, agencyId, emiratesId, areaAssigned, licenseNo, city, profileImage, licenseImage } = req.body;

    if (!email || !phone || !password || !countryCode) {
      return res.status(400).json({ success: false, message: 'Email, phone, password, and country code are required for verification' });
    }
    if (!role || ![ROLES.CUSTOMER, ROLES.DELIVERY_BOY, ROLES.SHOP_ADMIN, ROLES.AGENCY].includes(role)) {
      return res.status(400).json({ success: false, message: 'Valid role (CUSTOMER, DELIVERY_BOY, SHOP_ADMIN, AGENCY) is required' });
    }
    if (role === ROLES.DELIVERY_BOY) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: 'Latitude and longitude are required for delivery boy registration' });
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ success: false, message: 'Latitude and longitude must be numbers' });
      }
      if (agencyId) {
        const { DeliveryAgency } = require('../models/DeliveryAgency');
        const agencyExists = await DeliveryAgency.findById(agencyId);
        if (!agencyExists) return res.status(404).json({ success: false, message: 'Invalid agency ID' });
      }
    }

    let existingUser;
    if (role === ROLES.CUSTOMER) existingUser = await User.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
    else if (role === ROLES.DELIVERY_BOY) existingUser = await DeliveryBoy.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
    else if (role === ROLES.SHOP_ADMIN) existingUser = await ShopAdmin.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
    if (existingUser) return res.status(400).json({ success: false, message: 'User with this phone or email already exists' });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await EmailVerification.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { otp, expiresAt },
      { upsert: true, new: true }
    );

    const sent = await sendOTPEmail(email.trim(), otp);
    if (!sent) return res.status(500).json({ success: false, message: 'Failed to send verification email' });

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Use it to complete registration.',
      data: { email: email.trim() }
    });
  } catch (err) {
    logger.error('sendRegistrationVerification failed', { email: req.body.email, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to send verification', error: err.message });
  }
};

exports.verifyEmailAndRegister = async (req, res) => {
  try {
    const { email, otp, name, dob, phone, password, countryCode, role, latitude, longitude, agencyId, emiratesId, areaAssigned, licenseNo, city, profileImage, licenseImage } = req.body;

    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const record = await EmailVerification.findOne({ email: email.toLowerCase().trim() });
    if (!record) return res.status(400).json({ success: false, message: 'No verification found for this email. Please request a new code.' });
    if (record.otp !== String(otp).trim()) return res.status(400).json({ success: false, message: 'Invalid verification code' });
    if (new Date() > record.expiresAt) {
      await EmailVerification.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
    }
    if (!phone || !password || !countryCode || !role) {
      return res.status(400).json({ success: false, message: 'Phone, password, country code, and role are required' });
    }

    if (role === ROLES.DELIVERY_BOY) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, message: 'Latitude and longitude are required for delivery boy registration' });
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ success: false, message: 'Latitude and longitude must be numbers' });
      }
      if (agencyId) {
        const { DeliveryAgency } = require('../models/DeliveryAgency');
        const agencyExists = await DeliveryAgency.findById(agencyId);
        if (!agencyExists) return res.status(404).json({ success: false, message: 'Invalid agency ID' });
      }
    }

    let existingUser;
    if (role === ROLES.CUSTOMER) existingUser = await User.findOne({ phone });
    else if (role === ROLES.DELIVERY_BOY) existingUser = await DeliveryBoy.findOne({ phone });
    else if (role === ROLES.SHOP_ADMIN) existingUser = await ShopAdmin.findOne({ phone });
    if (existingUser) return res.status(400).json({ success: false, message: 'User with this phone number already exists' });

    let newUser;
    if (role === ROLES.CUSTOMER) {
      newUser = await User.create({ name, email: email.trim(), dob, phone, password, countryCode, role: ROLES.CUSTOMER });
    } else if (role === ROLES.DELIVERY_BOY) {
      newUser = await DeliveryBoy.create({
        name: name || 'New Delivery Boy', email: email.trim(), phone, password, countryCode, dob,
        licenseNo, emiratesId, profileImage, licenseImage, areaAssigned, city,
        latitude, longitude, availability: true, isOnline: false, accountVerify: false,
        assignedOrders: [], role: ROLES.DELIVERY_BOY, agencyId: agencyId || null
      });
    } else if (role === ROLES.SHOP_ADMIN) {
      newUser = await ShopAdmin.create({ name, email: email.trim(), dob, phone, password, countryCode, role: ROLES.SHOP_ADMIN });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    await EmailVerification.deleteOne({ _id: record._id });

    if (newUser.email) {
      sendGreetings(newUser.email, newUser.name || newUser.agencyDetails?.name)
        .then((r) => { if (!r.sent) logger.warn('Welcome email skipped', { email: newUser.email, error: r.error }); }) // ← replaced console.warn
        .catch((e) => logger.warn('Welcome email error', { email: newUser.email, error: e.message })); // ← replaced console.warn
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        userId: newUser._id, name: newUser.name, phone: newUser.phone,
        email: newUser.email, dob: newUser.dob != null ? newUser.dob : null, role: newUser.role,
        ...(role === ROLES.DELIVERY_BOY && {
          emiratesId: newUser.emiratesId, licenseNo: newUser.licenseNo,
          areaAssigned: newUser.areaAssigned, city: newUser.city,
          profileImage: newUser.profileImage, licenseImage: newUser.licenseImage,
          location: { latitude: newUser.latitude, longitude: newUser.longitude }
        })
      }
    });
  } catch (err) {
    logger.error('verifyEmailAndRegister failed', { email: req.body.email, role: req.body.role, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Registration failed', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password, role, device_id, device_token } = req.body;

    if (!role || !roleModelMap[role]) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    let user;
    if (role === ROLES.AGENCY) {
      const { DeliveryAgency } = require('../models/DeliveryAgency');
      user = await DeliveryAgency.findOne({ 'agencyDetails.agencyMail': email });
      if (!user) return res.status(401).json({ success: false, message: 'No account found with this email address. Please check and try again.' });

      const match = await user.comparePassword(password);
      if (!match) return res.status(401).json({ success: false, message: 'The password you entered is incorrect. Please try again.' });

      if (!user.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Your agency account is pending verification by the super admin. Please contact PreMart support.',
          notVerified: true,
          accountStatus: 'pending_verification'
        });
      }

      const token = generateToken({ id: user._id, role });
      if (device_id || device_token) await linkDeviceToUser(user._id.toString(), device_id, device_token);

      return res.json({
        success: true,
        message: 'Login successful',
        data: { id: user._id.toString(), role, token, agencyId: user._id.toString(), isVerified: user.isVerified }
      });
    }

    const Model = roleModelMap[role];
    if (role === ROLES.CUSTOMER) {
      user = await Model.findOne({ $or: [{ email }, { phone: email }] });
    } else {
      user = await Model.findOne({ email });
    }

    if (!user || !user.comparePassword) {
      return res.status(401).json({ success: false, message: 'No account found with this email address. Please check and try again.' });
    }

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ success: false, message: 'The password you entered is incorrect. Please try again.' });

    if (role === ROLES.CUSTOMER && user.accountVisibility === false) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact Premart admin.', accountDeactivated: true });
    }

    if (role === ROLES.SHOP_ADMIN) {
      const shop = await Shop.findById(user.shopId);
      if (shop && !shop.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Your shop account is pending verification by the super admin. Please contact PreMart support.',
          notVerified: true,
          accountStatus: 'pending_verification'
        });
      }
    }

    const tokenPayload = { id: user._id, role };
    if (role === ROLES.SHOP_ADMIN && user.shopId) tokenPayload.shopId = user.shopId;
    const token = generateToken(tokenPayload);

    if (device_id || device_token) await linkDeviceToUser(user._id.toString(), device_id, device_token);

    const response = {
      id: user._id, role, token,
      user: { name: user.name, email: user.email, phone: user.phone, accountVerify: user.accountVerify, dob: user.dob != null ? user.dob : null, profileImage: user.profileImage }
    };
    if (role === ROLES.SHOP_ADMIN) {
      response.shopId = user.shopId;
      const shop = await Shop.findById(user.shopId);
      response.isVerified = shop?.isVerified || false;
    }

    res.json({ success: true, message: 'Login successful', data: response });
  } catch (err) {
    logger.error('login failed', { email: req.body.email, role: req.body.role, error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({ success: false, message: 'An error occurred during login', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────
exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone is required' });
  return res.status(200).json({ success: true, message: 'OTP sent successfully (bypass enabled)' });
};

exports.verifyOtp = async (req, res) => {
  try {
    const { phone, role, countryCode, latitude, longitude, agencyId, code, deviceToken, deviceInfo } = req.body;
    if (!deviceToken) return res.status(400).json({ success: false, message: 'Device token is required' });
    if (code !== "123456") return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (!phone || !role) return res.status(400).json({ success: false, message: 'phone and role are required' });
    if (role !== 'DELIVERY_BOY') return res.status(403).json({ success: false, message: 'Only delivery boy supported' });

    const Model = roleModelMap[role];
    let user = await Model.findOne({ phone });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this phone number. Please contact your agency admin to register.', notRegistered: true });

    if (user.activeDeviceToken && user.activeDeviceToken !== deviceToken) {
      return res.status(409).json({ success: false, message: 'Your account is already logged in on another device. Please logout from the other device first.', alreadyLoggedIn: true, activeDeviceInfo: user.activeDeviceInfo || 'Unknown device' });
    }

    user.activeDeviceToken = deviceToken;
    user.activeDeviceInfo = deviceInfo || 'Unknown device';
    user.lastLoginAt = new Date();
    if (latitude) user.latitude = latitude;
    if (longitude) user.longitude = longitude;
    await user.save();

    const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ success: true, message: 'Login success', data: { id: user._id, role, token } });
  } catch (err) {
    logger.error('verifyOtp failed', { phone: req.body.phone, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.logoutDeliveryBoy = async (req, res) => {
  try {
    const { id } = req.user;
    await DeliveryBoy.findByIdAndUpdate(id, { activeDeviceToken: null, activeDeviceInfo: null, isOnline: false });
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    logger.error('logoutDeliveryBoy failed', { userId: req.user?.id, error: err.message, stack: err.stack }); // ← was missing before
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.forceLogoutDeliveryBoy = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, { activeDeviceToken: null, activeDeviceInfo: null, isOnline: false });
    return res.status(200).json({ success: true, message: 'Device session cleared' });
  } catch (err) {
    logger.error('forceLogoutDeliveryBoy failed', { deliveryBoyId: req.params.deliveryBoyId, error: err.message, stack: err.stack }); // ← was missing before
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CREATION
// ─────────────────────────────────────────────────────────────────────────────
exports.createSuperAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, countryCode } = req.body;
    if (!email || !password || !name) return res.status(400).json({ success: false, message: 'name, email, password are required' });

    const Model = roleModelMap[ROLES.SUPER_ADMIN];
    const exists = await Model.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Super admin already exists with this email' });

    const admin = await Model.create({ name, email, password, phone, countryCode, role: ROLES.SUPER_ADMIN });
    const token = generateToken({ id: admin._id, role: ROLES.SUPER_ADMIN });
    res.status(201).json({ success: true, message: 'Super admin created successfully', data: { id: admin._id, role: ROLES.SUPER_ADMIN, token } });
  } catch (err) {
    logger.error('createSuperAdmin failed', { email: req.body.email, error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createShopAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email, and password are required' });

    const Model = roleModelMap[ROLES.SHOP_ADMIN];
    const exists = await Model.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Shop admin with this email already exists' });

    const shop = await Shop.create({ shopeDetails: { shopName: name, shopMail: email, shopContact: phone || '' } });
    const admin = await Model.create({ name, email, password, phone: phone || '', role: ROLES.SHOP_ADMIN, shopId: shop._id });

    return res.status(201).json({
      success: true,
      message: 'Shop admin and shop created successfully',
      data: { adminId: admin._id.toString(), shopId: shop._id.toString(), email: admin.email, name: admin.name, phone: admin.phone, role: admin.role }
    });
  } catch (err) {
    logger.error('createShopAdmin failed', { email: req.body.email, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to create shop admin', error: err.message });
  }
};

exports.createAgency = async (req, res) => {
  try {
    const { agencyDetails } = req.body;
    if (!agencyDetails?.agencyName || !agencyDetails?.agencyMail) return res.status(400).json({ success: false, message: 'Agency name and email are required' });
    if (!agencyDetails?.agencyContact) return res.status(400).json({ success: false, message: 'Agency contact is required' });
    if (!agencyDetails?.city) return res.status(400).json({ success: false, message: 'City is required' });
    if (!agencyDetails?.emirates || !Array.isArray(agencyDetails.emirates) || agencyDetails.emirates.length === 0) return res.status(400).json({ success: false, message: 'At least one emirate is required' });
    if (!agencyDetails?.licenseAuthority) return res.status(400).json({ success: false, message: 'License issuing authority is required' });

    const { DeliveryAgency } = require('../models/DeliveryAgency');
    const exists = await DeliveryAgency.findOne({ 'agencyDetails.email': agencyDetails.agencyMail });
    if (exists) return res.status(400).json({ success: false, message: 'Agency with this email already exists' });

    const agency = await DeliveryAgency.create({ agencyDetails: { ...agencyDetails, email: agencyDetails.agencyMail, password: agencyDetails.password || 'password@123', role: ROLES.AGENCY } });
    return res.status(201).json({ success: true, message: 'Agency created successfully', data: { agencyId: agency._id, agencyName: agency.agencyDetails.agencyName, agencyEmail: agency.agencyDetails.agencyMail } });
  } catch (err) {
    logger.error('createAgency failed', { error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({ success: false, message: 'Failed to create agency', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: ROLES.CUSTOMER }).select('-password -__v').sort({ createdAt: -1 });
    const flatData = customers.map(u => ({
      userId: u._id, name: u.name || null, email: u.email || null, phone: u.phone || null,
      accountVerify: u.accountVerify || false, accountVisibility: u.accountVisibility || false,
      createdAt: u.createdAt, address: u.address?.[0]?.address || null,
      area: u.address?.[0]?.area || null, place: u.address?.[0]?.place || null, contact: u.address?.[0]?.contact || null,
    }));
    return res.status(200).json({ success: true, message: 'All customers fetched successfully', count: flatData.length, data: flatData });
  } catch (err) {
    logger.error('getAllCustomers failed', { error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to fetch customers', data: err.message });
  }
};

exports.getCustomerDetailsById = async (req, res) => {
  try {
    const { userId } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: 'Invalid customer ID format' });

    const customer = await User.findById(userId).select('-password -__v').lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    return res.status(200).json({ success: true, message: 'Customer details fetched successfully', data: customer });
  } catch (err) {
    logger.error('getCustomerDetailsById failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to fetch customer details', error: err.message });
  }
};

exports.getCustomerOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: 'Invalid customer ID format' });

    const Order = require('../models/Order');
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, message: 'Customer orders fetched successfully', count: orders.length, data: orders });
  } catch (err) {
    logger.error('getCustomerOrders failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to fetch customer orders', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────
exports.registerAgency = async (req, res) => {
  try {
    const { email, password, agencyDetails } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });
    if (!agencyDetails?.agencyName || !agencyDetails?.agencyContact) return res.status(400).json({ success: false, message: 'Agency name and contact are required' });
    if (!agencyDetails?.city) return res.status(400).json({ success: false, message: 'City is required' });
    if (!agencyDetails?.emirates || !Array.isArray(agencyDetails.emirates) || agencyDetails.emirates.length === 0) return res.status(400).json({ success: false, message: 'At least one emirate is required' });
    if (!agencyDetails?.licenseAuthority) return res.status(400).json({ success: false, message: 'License issuing authority is required' });

    const { DeliveryAgency } = require('../models/DeliveryAgency');
    const existingAgency = await DeliveryAgency.findOne({ 'agencyDetails.email': email });
    if (existingAgency) return res.status(400).json({ success: false, message: 'Agency with this email already exists' });

    const agency = await DeliveryAgency.create({ agencyDetails: { ...agencyDetails, email, password, role: ROLES.AGENCY }, isVerified: false });

    try {
      await notifyRegistrationRequest('Agency', agency._id, agency.agencyDetails?.agencyName || 'New Agency');
    } catch (notifErr) {
      logger.warn('Registration notification failed for agency', { agencyId: agency._id, error: notifErr.message }); // ← replaced console.warn
    }

    const token = generateToken({ id: agency._id, role: ROLES.AGENCY });
    return res.status(201).json({ success: true, message: 'Agency registered successfully. Awaiting admin verification.', data: { agencyId: agency._id, role: ROLES.AGENCY, token, isVerified: false } });
  } catch (err) {
    logger.error('registerAgency failed', { email: req.body.email, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Agency registration failed', error: err.message });
  }
};

exports.registerShopAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, supportMail, supportNumber, shopLicenseNumber, shopLicenseExpiry, EmiratesId, taxRegistrationNumber, location, shopAddress, city, emirates, bankName, accountNumber, ibanNumber, branch, swiftCode, shopLicenseImage, EmiratesIdImage, firebaseUid, emailVerified } = req.body;

    if (!name || !email || !phone || !password) return res.status(400).json({ success: false, message: 'Name, email, phone, and password are required' });
    if (!supportMail || !supportNumber) return res.status(400).json({ success: false, message: 'Support email and phone are required' });
    if (!shopLicenseNumber || !shopLicenseExpiry) return res.status(400).json({ success: false, message: 'Trade license number and expiry date are required' });
    if (!taxRegistrationNumber) return res.status(400).json({ success: false, message: 'Tax Registration Number (TRN) is required' });
    if (!location || !shopAddress) return res.status(400).json({ success: false, message: 'Shop location and address are required' });
    if (!shopLicenseImage || !EmiratesIdImage) return res.status(400).json({ success: false, message: 'Trade license and Emirates ID images are required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });

    const existingAdmin = await ShopAdmin.findOne({ email });
    if (existingAdmin) return res.status(400).json({ success: false, message: 'Shop with this email already exists' });

    const shop = await Shop.create({
      shopeDetails: {
        shopName: name, shopMail: email, shopContact: phone,
        supportMail: supportMail || email, supportNumber: supportNumber || phone, password,
        shopLicenseNumber, shopLicenseExpiry, EmiratesId, taxRegistrationNumber,
        shopLocation: location, shopAddress, city: emirates || city || 'Dubai', emirates: emirates || 'Dubai',
        shopLicenseImage, EmiratesIdImage,
        shopBankDetails: { bankName: bankName || '', accountNumber: accountNumber || '', ibanNumber: ibanNumber || '', branch: branch || '', swiftCode: swiftCode || '' }
      },
      isVerified: false, products: [], orders: []
    });

    const admin = await ShopAdmin.create({ name, email, phone, password, countryCode: '+971', role: ROLES.SHOP_ADMIN, shopId: shop._id });

    try {
      await notifyRegistrationRequest('Shop', shop._id, name);
    } catch (notifErr) {
      logger.warn('Registration notification failed for shop', { shopId: shop._id, error: notifErr.message }); // ← replaced console.warn
    }

    const token = generateToken({ id: admin._id, role: ROLES.SHOP_ADMIN });
    return res.status(201).json({
      success: true,
      message: 'Shop registered successfully. Awaiting admin verification.',
      data: {
        adminId: admin._id, shopId: shop._id, role: ROLES.SHOP_ADMIN, token, isVerified: false,
        shopDetails: { shopName: shop.shopeDetails.shopName, shopMail: shop.shopeDetails.shopMail, shopContact: shop.shopeDetails.shopContact, emirates: shop.shopeDetails.emirates, shopLicenseNumber: shop.shopeDetails.shopLicenseNumber }
      }
    });
  } catch (err) {
    logger.error('registerShopAdmin failed', { email: req.body.email, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Shop registration failed', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET
// ─────────────────────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ success: false, message: 'Email and role are required' });

    const allowedRoles = ['CUSTOMER', 'DELIVERY_BOY', 'SHOP_ADMIN', 'AGENCY'];
    if (!allowedRoles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role. Password reset is available for Customer, Delivery Boy, Shop, and Agency accounts.' });

    const Model = roleModelMap[role];
    if (!Model) return res.status(400).json({ success: false, message: 'Invalid role specified' });

    let user;
    if (role === 'AGENCY') {
      const { DeliveryAgency } = require('../models/DeliveryAgency');
      user = await DeliveryAgency.findOne({ $or: [{ 'agencyDetails.email': email }, { 'agencyDetails.agencyMail': email }] });
    } else {
      user = await Model.findOne({ email });
    }

    if (!user) return res.status(200).json({ success: true, message: 'If an account exists with this email, a 6-digit OTP has been sent.' });

    const resetOTP = String(crypto.randomInt(100000, 999999));
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);
    user.resetPasswordOTP = resetOTP;
    user.resetPasswordExpires = otpExpiry;
    await user.save();

    const emailSent = await sendOTPEmail(email, resetOTP, 'PreMart');
    if (!emailSent) {
      logger.warn('Password reset email failed to send', { email }); // ← replaced implicit missing log
      return res.status(503).json({ success: false, message: 'Could not send OTP email. Please try again later.', data: { email } });
    }

    return res.status(200).json({ success: true, message: 'If an account exists with this email, a password reset OTP has been sent to your email.', data: { email, expiresAt: otpExpiry } });
  } catch (err) {
    logger.error('forgotPassword failed', { email: req.body.email, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to process forgot password request', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, role } = req.body;
    if (!email || !otp || !newPassword || !role) return res.status(400).json({ success: false, message: 'Email, OTP, new password, and role are required' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });

    const allowedRoles = ['CUSTOMER', 'DELIVERY_BOY', 'SHOP_ADMIN', 'AGENCY'];
    if (!allowedRoles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role. Password reset is available for Customer, Delivery Boy, Shop, and Agency accounts.' });

    const Model = roleModelMap[role];
    if (!Model) return res.status(400).json({ success: false, message: 'Invalid role specified' });

    let user;
    if (role === 'AGENCY') {
      const { DeliveryAgency } = require('../models/DeliveryAgency');
      user = await DeliveryAgency.findOne({ $or: [{ 'agencyDetails.email': email }, { 'agencyDetails.agencyMail': email }] });
    } else {
      user = await Model.findOne({ email });
    }

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.resetPasswordOTP || String(user.resetPasswordOTP) !== String(otp)) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });

    if (role === 'AGENCY') user.agencyDetails.password = newPassword;
    else user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password has been reset successfully. You can now login with your new password.' });
  } catch (err) {
    logger.error('resetPassword failed', { email: req.body.email, role: req.body.role, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to reset password', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleAccountVisibility = async (req, res) => {
  try {
    const { userId } = req.params;
    const { visibility } = req.body;
    if (visibility === undefined) return res.status(400).json({ success: false, message: 'visibility (true/false) is required' });

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.accountVisibility = visibility;
    await user.save();
    return res.status(200).json({ success: true, message: `Account visibility turned ${visibility ? 'ON' : 'OFF'} successfully`, data: { userId: user._id, accountVisibility: user.accountVisibility } });
  } catch (err) {
    logger.error('toggleAccountVisibility failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to update account visibility', error: err.message });
  }
};

exports.toggleShopVerification = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { isVerified } = req.body;
    if (isVerified === undefined) return res.status(400).json({ success: false, message: 'isVerified (true/false) is required' });

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(shopId)) return res.status(400).json({ success: false, message: 'Invalid shop ID' });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    shop.isVerified = isVerified;
    await shop.save();
    await notifyShopVerification(shop, isVerified);

    return res.status(200).json({ success: true, message: `Shop ${isVerified ? 'verified' : 'unverified'} successfully`, data: { shopId: shop._id, shopName: shop.shopeDetails?.shopName, isVerified: shop.isVerified } });
  } catch (err) {
    logger.error('toggleShopVerification failed', { shopId: req.params.shopId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to update shop verification status', error: err.message });
  }
};

exports.toggleAgencyVerification = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { isVerified } = req.body;
    if (isVerified === undefined) return res.status(400).json({ success: false, message: 'isVerified (true/false) is required' });

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(agencyId)) return res.status(400).json({ success: false, message: 'Invalid agency ID' });

    const { DeliveryAgency } = require('../models/DeliveryAgency');
    const agency = await DeliveryAgency.findById(agencyId);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    agency.isVerified = isVerified;
    await agency.save();
    await notifyAgencyVerification(agency, isVerified);

    return res.status(200).json({ success: true, message: `Agency ${isVerified ? 'verified' : 'unverified'} successfully`, data: { agencyId: agency._id, agencyName: agency.agencyDetails?.agencyName, isVerified: agency.isVerified } });
  } catch (err) {
    logger.error('toggleAgencyVerification failed', { agencyId: req.params.agencyId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to update agency verification status', error: err.message });
  }
};

exports.rejectShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { rejectionReason } = req.body;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(shopId)) return res.status(400).json({ success: false, message: 'Invalid shop ID' });

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    shop.isVerified = false;
    shop.shopeDetails.rejectionReason = rejectionReason || 'No reason provided';
    shop.shopeDetails.rejectedAt = new Date();
    await shop.save();

    const shopEmail = shop.shopeDetails?.shopMail;
    const shopName = shop.shopeDetails?.shopName;
    if (shopEmail) {
      const { sendShopRejectionEmail } = require('../services/emailService');
      sendShopRejectionEmail(shopEmail, shopName, rejectionReason)
        .then(sent => { if (!sent) logger.warn('Shop rejection email failed', { shopId, email: shopEmail }); }) // ← replaced console.warn
        .catch(e => logger.warn('Shop rejection email error', { shopId, email: shopEmail, error: e.message })); // ← replaced console.warn
    }

    return res.status(200).json({
      success: true,
      message: `Shop rejected successfully${rejectionReason ? ' with reason provided' : ''}`,
      data: { shopId: shop._id, shopName: shop.shopeDetails?.shopName, isVerified: shop.isVerified, rejectionReason: shop.shopeDetails.rejectionReason, rejectedAt: shop.shopeDetails.rejectedAt }
    });
  } catch (err) {
    logger.error('rejectShop failed', { shopId: req.params.shopId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to reject shop', error: err.message });
  }
};

exports.rejectAgency = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { rejectionReason } = req.body;

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(agencyId)) return res.status(400).json({ success: false, message: 'Invalid agency ID' });

    const { DeliveryAgency } = require('../models/DeliveryAgency');
    const agency = await DeliveryAgency.findById(agencyId);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });

    agency.isVerified = false;
    agency.agencyDetails.rejectionReason = rejectionReason || 'No reason provided';
    agency.agencyDetails.rejectedAt = new Date();
    await agency.save();

    const agencyEmail = agency.agencyDetails?.agencyMail || agency.agencyDetails?.email;
    const agencyName = agency.agencyDetails?.agencyName;
    if (agencyEmail) {
      const { sendAgencyRejectionEmail } = require('../services/emailService');
      sendAgencyRejectionEmail(agencyEmail, agencyName, rejectionReason)
        .then(sent => { if (!sent) logger.warn('Agency rejection email failed', { agencyId, email: agencyEmail }); }) // ← replaced console.warn
        .catch(e => logger.warn('Agency rejection email error', { agencyId, email: agencyEmail, error: e.message })); // ← replaced console.warn
    }

    return res.status(200).json({
      success: true,
      message: `Agency rejected successfully${rejectionReason ? ' with reason provided' : ''}`,
      data: { agencyId: agency._id, agencyName: agency.agencyDetails?.agencyName, isVerified: agency.isVerified, rejectionReason: agency.agencyDetails.rejectionReason, rejectedAt: agency.agencyDetails.rejectedAt }
    });
  } catch (err) {
    logger.error('rejectAgency failed', { agencyId: req.params.agencyId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to reject agency', error: err.message });
  }
};