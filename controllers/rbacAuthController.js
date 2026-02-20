// controllers/authController.js (rbacAuthController)
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
const { sendOTPEmail,sendDeliveryBoyWelcomeEmail } = require('../services/emailService');
const OTP_EXPIRY_MINUTES = 15;

// ✅ FIX: Import ShopAdmin from Admin.js, NOT Shop.js
const { ShopAdmin, SuperAdmin } = require('../models/AdminAuth');
const { notifyShopVerification, notifyAgencyVerification, notifyRegistrationRequest } = require('./bellNotifications');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = '7d';

const generateToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

/** Generate 6-digit OTP */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────────────────────

exports.register = async (req, res) => {
  try {
    const {
      name, email, dob, phone, password, countryCode, role,
      latitude, longitude, agencyId,
      emiratesId, areaAssigned, licenseNo, city, profileImage, licenseImage,
    } = req.body;

    console.log('📦 Registration payload:', req.body);

    if (!phone || !password || !countryCode) {
      return res.status(400).json({ success: false, message: 'Phone, password, and country code are required' });
    }

    // Delivery Boy validation
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
        if (!agencyExists) {
          return res.status(404).json({ success: false, message: 'Invalid agency ID' });
        }
      }
    }

    // Check existing user
    let existingUser;
    if (role === ROLES.CUSTOMER) existingUser = await User.findOne({ phone });
    else if (role === ROLES.DELIVERY_BOY) existingUser = await DeliveryBoy.findOne({ phone });
    else if (role === ROLES.SHOP_ADMIN) existingUser = await ShopAdmin.findOne({ phone });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
    }

    let newUser;

    // Customer registration
    if (role === ROLES.CUSTOMER) {
      newUser = await User.create({
        name,
        email,
        dob,
        phone,
        password,
        countryCode,
        role: ROLES.CUSTOMER
      });
    }

    // Delivery Boy registration
    else if (role === ROLES.DELIVERY_BOY) {
      newUser = await DeliveryBoy.create({
        name: name || 'New Delivery Boy',
        email, phone, password, countryCode, dob,
        licenseNo, emiratesId, profileImage, licenseImage,
        areaAssigned, city,
        latitude, longitude,
        availability: true,
        isOnline: false,
        accountVerify: false,
        assignedOrders: [],
        role: ROLES.DELIVERY_BOY,
        agencyId: agencyId || null
      });

      console.log('✅ Delivery boy created:', newUser._id);

       if (newUser.email) {
    sendDeliveryBoyWelcomeEmail(newUser.email, newUser.name, newUser.phone)
  .then(sent => {
    if (sent) console.log('✅ Welcome email sent to delivery boy:', newUser.email);
    else console.warn('⚠️ Welcome email failed for:', newUser.email);
  })
  .catch(e => console.warn('⚠️ Welcome email error:', e.message));

  }
    }

    // Shop Admin registration
    else if (role === ROLES.SHOP_ADMIN) {
      newUser = await ShopAdmin.create({
        name,
        email,
        dob,
        phone,
        password,
        countryCode,
        role: ROLES.SHOP_ADMIN
      });
    }

    else {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    // Send welcome email if user has email
    if (newUser.email) {
      sendGreetings(newUser.email, newUser.name || newUser.agencyDetails?.name)
        .then((r) => { if (!r.sent) console.warn('Welcome email skipped:', r.error); })
        .catch((e) => console.warn('Welcome email error:', e.message));
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        userId: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        dob: newUser.dob != null ? newUser.dob : null,
        role: newUser.role,
        ...(role === ROLES.DELIVERY_BOY && {
          emiratesId: newUser.emiratesId,
          licenseNo: newUser.licenseNo,
          areaAssigned: newUser.areaAssigned,
          city: newUser.city,
          profileImage: newUser.profileImage,
          licenseImage: newUser.licenseImage,
          location: { latitude: newUser.latitude, longitude: newUser.longitude }
        })
      }
    });
  } catch (err) {
    console.error('❌ Registration Error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL VERIFICATION FLOW (dev-irshad)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1: Send verification OTP to email. Account is NOT created yet.
 * Body: same as register (name, email, phone, password, countryCode, role, ...). Email is required.
 */
exports.sendRegistrationVerification = async (req, res) => {
  try {
    const {
      name, email, dob, phone, password, countryCode, role,
      latitude, longitude, agencyId, emiratesId, areaAssigned, licenseNo, city, profileImage, licenseImage
    } = req.body;

    if (!email || !phone || !password || !countryCode) {
      return res.status(400).json({
        success: false,
        message: 'Email, phone, password, and country code are required for verification'
      });
    }

    if (!role || ![ROLES.CUSTOMER, ROLES.DELIVERY_BOY, ROLES.SHOP_ADMIN, ROLES.AGENCY].includes(role)) {
  return res.status(400).json({
    success: false,
    message: 'Valid role (CUSTOMER, DELIVERY_BOY, SHOP_ADMIN, AGENCY) is required'
  });
}

    if (role === ROLES.DELIVERY_BOY) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required for delivery boy registration'
        });
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude must be numbers'
        });
      }
      if (agencyId) {
        const { DeliveryAgency } = require('../models/DeliveryAgency');
        const agencyExists = await DeliveryAgency.findById(agencyId);
        if (!agencyExists) {
          return res.status(404).json({ success: false, message: 'Invalid agency ID' });
        }
      }
    }

    let existingUser;
    if (role === ROLES.CUSTOMER) {
      existingUser = await User.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
    } else if (role === ROLES.DELIVERY_BOY) {
      existingUser = await DeliveryBoy.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
    } else if (role === ROLES.SHOP_ADMIN) {
      existingUser = await ShopAdmin.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
    }
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone or email already exists'
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await EmailVerification.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { otp, expiresAt },
      { upsert: true, new: true }
    );

   const sent = await sendOTPEmail(email.trim(), otp);
if (!sent) {
  return res.status(500).json({
    success: false,
    message: 'Failed to send verification email'
  });
}

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Use it to complete registration.',
      data: { email: email.trim() }
    });
  } catch (err) {
    console.error('❌ Send registration verification error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification',
      error: err.message
    });
  }
};

/**
 * Step 2: Verify email OTP and create account. Call after sendRegistrationVerification.
 * Body: email, otp, + same registration fields (name, phone, password, countryCode, role, ...).
 */
exports.verifyEmailAndRegister = async (req, res) => {
  try {
    const {
      email, otp,
      name, dob, phone, password, countryCode, role,
      latitude, longitude, agencyId, emiratesId, areaAssigned, licenseNo, city, profileImage, licenseImage
    } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const record = await EmailVerification.findOne({ email: email.toLowerCase().trim() });
    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'No verification found for this email. Please request a new code.'
      });
    }
    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
    if (new Date() > record.expiresAt) {
      await EmailVerification.deleteOne({ _id: record._id });
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    if (!phone || !password || !countryCode || !role) {
      return res.status(400).json({
        success: false,
        message: 'Phone, password, country code, and role are required'
      });
    }

    if (role === ROLES.DELIVERY_BOY) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required for delivery boy registration'
        });
      }
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude must be numbers'
        });
      }
      if (agencyId) {
        const { DeliveryAgency } = require('../models/DeliveryAgency');
        const agencyExists = await DeliveryAgency.findById(agencyId);
        if (!agencyExists) {
          return res.status(404).json({ success: false, message: 'Invalid agency ID' });
        }
      }
    }

    let existingUser;
    if (role === ROLES.CUSTOMER) {
      existingUser = await User.findOne({ phone });
    } else if (role === ROLES.DELIVERY_BOY) {
      existingUser = await DeliveryBoy.findOne({ phone });
    } else if (role === ROLES.SHOP_ADMIN) {
      existingUser = await ShopAdmin.findOne({ phone });
    }
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    let newUser;
    if (role === ROLES.CUSTOMER) {
      newUser = await User.create({
        name,
        email: email.trim(),
        dob,
        phone,
        password,
        countryCode,
        role: ROLES.CUSTOMER
      });
    } else if (role === ROLES.DELIVERY_BOY) {
      newUser = await DeliveryBoy.create({
        name: name || 'New Delivery Boy',
        email: email.trim(),
        phone,
        password,
        countryCode,
        dob,
        licenseNo,
        emiratesId,
        profileImage,
        licenseImage,
        areaAssigned,
        city,
        latitude,
        longitude,
        availability: true,
        isOnline: false,
        accountVerify: false,
        assignedOrders: [],
        role: ROLES.DELIVERY_BOY,
        agencyId: agencyId || null
      });
    } else if (role === ROLES.SHOP_ADMIN) {
      newUser = await ShopAdmin.create({
        name,
        email: email.trim(),
        dob,
        phone,
        password,
        countryCode,
        role: ROLES.SHOP_ADMIN
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    await EmailVerification.deleteOne({ _id: record._id });

    if (newUser.email) {
      sendGreetings(newUser.email, newUser.name || newUser.agencyDetails?.name)
        .then((r) => { if (!r.sent) console.warn('Welcome email skipped:', r.error); })
        .catch((e) => console.warn('Welcome email error:', e.message));
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        userId: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        dob: newUser.dob != null ? newUser.dob : null,
        role: newUser.role,
        ...(role === ROLES.DELIVERY_BOY && {
          emiratesId: newUser.emiratesId,
          licenseNo: newUser.licenseNo,
          areaAssigned: newUser.areaAssigned,
          city: newUser.city,
          profileImage: newUser.profileImage,
          licenseImage: newUser.licenseImage,
          location: {
            latitude: newUser.latitude,
            longitude: newUser.longitude
          }
        })
      }
    });
  } catch (err) {
    console.error('❌ Verify email and register error:', err);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: err.message
    });
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

    // =======================
    // AGENCY LOGIN
    // =======================
    if (role === ROLES.AGENCY) {
      console.log('🔐 AGENCY LOGIN ATTEMPT');
      console.log('Email:', email);

      const { DeliveryAgency } = require('../models/DeliveryAgency');
      user = await DeliveryAgency.findOne({ 'agencyDetails.agencyMail': email });

      console.log('User found:', user ? 'YES' : 'NO');
      if (user) console.log('Agency ID:', user._id.toString());

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const match = await user.comparePassword(password);
      console.log('Password match:', match ? 'YES' : 'NO');

      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      if (!user.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Your agency account is pending verification by the super admin. Please contact PreMart support.',
          notVerified: true,
          accountStatus: 'pending_verification'
        });
      }

      const token = generateToken({ id: user._id, role });
      if (device_id || device_token) {
        await linkDeviceToUser(user._id.toString(), device_id, device_token);
      }

      const responseData = {
        id: user._id.toString(),
        role,
        token,
        agencyId: user._id.toString(),
        isVerified: user.isVerified
      };

      console.log('✅ LOGIN SUCCESS - Sending response:');
      console.log(JSON.stringify(responseData, null, 2));
      return res.json({
        success: true,
        message: 'Login successful',
        data: responseData
      });
    }

    // =======================
    // ALL OTHER ROLES
    // =======================
    const Model = roleModelMap[role];

    if (role === ROLES.CUSTOMER) {
      user = await Model.findOne({
        $or: [
          { email: email },
          { phone: email } // allows phone entered in email field
        ]
      });
    } else {
      user = await Model.findOne({ email });
    }

    if (!user || !user.comparePassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Customer account visibility check
    if (role === ROLES.CUSTOMER && user.accountVisibility === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact Premart admin.',
        accountDeactivated: true
      });
    }

    // Shop verification check
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

    if (device_id || device_token) {
      await linkDeviceToUser(user._id.toString(), device_id, device_token);
    }

    const response = {
      id: user._id,
      role,
      token,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        accountVerify: user.accountVerify,
        dob: user.dob != null ? user.dob : null,
        profileImage: user.profileImage,
      }
    };

    if (role === ROLES.SHOP_ADMIN) {
      response.shopId = user.shopId;
      const shop = await Shop.findById(user.shopId);
      response.isVerified = shop?.isVerified || false;
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: response
    });

  } catch (err) {
    console.error('Login Error:', err);
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this phone number. Please contact your agency admin to register.',
        notRegistered: true,
      });
    }

    if (user.activeDeviceToken && user.activeDeviceToken !== deviceToken) {
      return res.status(409).json({
        success: false,
        message: 'Your account is already logged in on another device. Please logout from the other device first.',
        alreadyLoggedIn: true,
        activeDeviceInfo: user.activeDeviceInfo || 'Unknown device',
      });
    }

    user.activeDeviceToken = deviceToken;
    user.activeDeviceInfo = deviceInfo || 'Unknown device';
    user.lastLoginAt = new Date();
    if (latitude) user.latitude = latitude;
    if (longitude) user.longitude = longitude;
    await user.save();

    const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({
      success: true,
      message: 'Login success',
      data: { id: user._id, role, token }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.logoutDeliveryBoy = async (req, res) => {
  try {
    const { id } = req.user;
    await DeliveryBoy.findByIdAndUpdate(id, {
      activeDeviceToken: null,
      activeDeviceInfo: null,
      isOnline: false
    });
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.forceLogoutDeliveryBoy = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
      activeDeviceToken: null,
      activeDeviceInfo: null,
      isOnline: false
    });
    return res.status(200).json({ success: true, message: 'Device session cleared' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CREATION
// ─────────────────────────────────────────────────────────────────────────────

exports.createSuperAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, countryCode } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'name, email, password are required'
      });
    }

    const Model = roleModelMap[ROLES.SUPER_ADMIN];
    const exists = await Model.findOne({ email });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Super admin already exists with this email'
      });
    }

    const admin = await Model.create({
      name, email, password, phone, countryCode,
      role: ROLES.SUPER_ADMIN
    });

    const token = generateToken({ id: admin._id, role: ROLES.SUPER_ADMIN });

    res.status(201).json({
      success: true,
      message: 'Super admin created successfully',
      data: { id: admin._id, role: ROLES.SUPER_ADMIN, token }
    });
  } catch (err) {
    console.error('Create SuperAdmin Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createShopAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    const Model = roleModelMap[ROLES.SHOP_ADMIN];
    const exists = await Model.findOne({ email });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Shop admin with this email already exists'
      });
    }

    const shop = await Shop.create({
      shopeDetails: {
        shopName: name,
        shopMail: email,
        shopContact: phone || ''
      }
    });

    const admin = await Model.create({
      name, email, password,
      phone: phone || '',
      role: ROLES.SHOP_ADMIN,
      shopId: shop._id
    });

    return res.status(201).json({
      success: true,
      message: 'Shop admin and shop created successfully',
      data: {
        adminId: admin._id.toString(),
        shopId: shop._id.toString(),
        email: admin.email,
        name: admin.name,
        phone: admin.phone,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Create Shop Admin Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create shop admin',
      error: err.message
    });
  }
};

exports.createAgency = async (req, res) => {
  try {
    const { agencyDetails } = req.body;

    if (!agencyDetails?.agencyName || !agencyDetails?.agencyMail) {
      return res.status(400).json({ success: false, message: 'Agency name and email are required' });
    }
    if (!agencyDetails?.agencyContact) {
      return res.status(400).json({ success: false, message: 'Agency contact is required' });
    }
    if (!agencyDetails?.city) {
      return res.status(400).json({ success: false, message: 'City is required' });
    }
    if (!agencyDetails?.emirates || !Array.isArray(agencyDetails.emirates) || agencyDetails.emirates.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one emirate is required' });
    }
    if (!agencyDetails?.licenseAuthority) {
      return res.status(400).json({ success: false, message: 'License issuing authority is required' });
    }

    const { DeliveryAgency } = require('../models/DeliveryAgency');
    const exists = await DeliveryAgency.findOne({ 'agencyDetails.email': agencyDetails.agencyMail });

    if (exists) {
      return res.status(400).json({ success: false, message: 'Agency with this email already exists' });
    }

    const agency = await DeliveryAgency.create({
      agencyDetails: {
        ...agencyDetails,
        email: agencyDetails.agencyMail,
        password: agencyDetails.password || 'password@123',
        role: ROLES.AGENCY
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Agency created successfully',
      data: {
        agencyId: agency._id,
        agencyName: agency.agencyDetails.agencyName,
        agencyEmail: agency.agencyDetails.agencyMail
      }
    });
  } catch (err) {
    console.error('❌ Create Agency Error:', err);
    res.status(500).json({ success: false, message: 'Failed to create agency', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: ROLES.CUSTOMER })
      .select('-password -__v')
      .sort({ createdAt: -1 });

    const flatData = customers.map(u => ({
      userId: u._id,
      name: u.name || null,
      email: u.email || null,
      phone: u.phone || null,
      accountVerify: u.accountVerify || false,
      accountVisibility: u.accountVisibility || false,
      createdAt: u.createdAt,
      address: u.address?.[0]?.address || null,
      area: u.address?.[0]?.area || null,
      place: u.address?.[0]?.place || null,
      contact: u.address?.[0]?.contact || null,
    }));

    return res.status(200).json({
      success: true,
      message: 'All customers fetched successfully',
      count: flatData.length,
      data: flatData
    });
  } catch (err) {
    console.error('Get Customers Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch customers', data: err.message });
  }
};

exports.getCustomerDetailsById = async (req, res) => {
  try {
    const { userId } = req.params;
    const mongoose = require('mongoose');

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID format' });
    }

    const customer = await User.findById(userId).select('-password -__v').lean();

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Customer details fetched successfully',
      data: customer
    });
  } catch (err) {
    console.error('Get Customer Details Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch customer details', error: err.message });
  }
};

exports.getCustomerOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const mongoose = require('mongoose');

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID format' });
    }

    const Order = require('../models/Order');
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      message: 'Customer orders fetched successfully',
      count: orders.length,
      data: orders
    });
  } catch (err) {
    console.error('Get Customer Orders Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch customer orders', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

exports.registerAgency = async (req, res) => {
  try {
    const { email, password, agencyDetails } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    if (!agencyDetails?.agencyName || !agencyDetails?.agencyContact) {
      return res.status(400).json({ success: false, message: 'Agency name and contact are required' });
    }
    if (!agencyDetails?.city) {
      return res.status(400).json({ success: false, message: 'City is required' });
    }
    if (!agencyDetails?.emirates || !Array.isArray(agencyDetails.emirates) || agencyDetails.emirates.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one emirate is required' });
    }
    if (!agencyDetails?.licenseAuthority) {
      return res.status(400).json({ success: false, message: 'License issuing authority is required' });
    }

    const { DeliveryAgency } = require('../models/DeliveryAgency');
    const existingAgency = await DeliveryAgency.findOne({ 'agencyDetails.email': email });

    if (existingAgency) {
      return res.status(400).json({ success: false, message: 'Agency with this email already exists' });
    }

    const agency = await DeliveryAgency.create({
      agencyDetails: {
        ...agencyDetails,
        email,
        password,
        role: ROLES.AGENCY
      },
      isVerified: false // ✅ Start as unverified
    });

    // ✅ NOTIFICATION: Notify super admin about new agency registration
    try {
      await notifyRegistrationRequest('Agency', agency._id, agency.agencyDetails?.agencyName || 'New Agency');
      console.log('✅ Super admin notified about new agency registration');
    } catch (notifErr) {
      console.warn('⚠️ Registration notification failed:', notifErr.message);
    }

    const token = generateToken({ id: agency._id, role: ROLES.AGENCY });

    return res.status(201).json({
      success: true,
      message: 'Agency registered successfully. Awaiting admin verification.',
      data: {
        agencyId: agency._id,
        role: ROLES.AGENCY,
        token,
        isVerified: false
      }
    });
  } catch (err) {
    console.error('❌ Agency Registration Error:', err);
    return res.status(500).json({ success: false, message: 'Agency registration failed', error: err.message });
  }
};

exports.registerShopAdmin = async (req, res) => {
  try {
    const {
      // ═══════════════════════════════════════════════════════════════════
      // BASIC INFORMATION
      // ═══════════════════════════════════════════════════════════════════
      name,
      email,
      phone,
      password,
      supportMail,
      supportNumber,

      // ═══════════════════════════════════════════════════════════════════
      // LEGAL & LICENSING
      // ═══════════════════════════════════════════════════════════════════
      shopLicenseNumber,
      shopLicenseExpiry,
      EmiratesId,
      taxRegistrationNumber,

      // ═══════════════════════════════════════════════════════════════════
      // LOCATION
      // ═══════════════════════════════════════════════════════════════════
      location,        // "lat,lng" string
      shopAddress,     // Full address from Google Maps
      city,            // Emirates name or city
      emirates,        // Detected emirate

      // ═══════════════════════════════════════════════════════════════════
      // BANK DETAILS
      // ═══════════════════════════════════════════════════════════════════
      bankName,
      accountNumber,
      ibanNumber,
      branch,
      swiftCode,

      // ═══════════════════════════════════════════════════════════════════
      // DOCUMENTS (S3 URLs)
      // ═══════════════════════════════════════════════════════════════════
      shopLicenseImage,   // S3 URL for trade license
      EmiratesIdImage,    // S3 URL for Emirates ID

      // ═══════════════════════════════════════════════════════════════════
      // FIREBASE
      // ═══════════════════════════════════════════════════════════════════
      firebaseUid,
      emailVerified
    } = req.body;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🏪 SHOP REGISTRATION REQUEST');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Email:', email);
    console.log('Shop Name:', name);
    console.log('Phone:', phone);
    console.log('Emirates:', emirates);
    console.log('License:', shopLicenseNumber);
    console.log('TRN:', taxRegistrationNumber);
    console.log('Bank:', bankName);
    console.log('IBAN:', ibanNumber);
    console.log('═══════════════════════════════════════════════════════════');

    // ═══════════════════════════════════════════════════════════════════
    // VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, and password are required'
      });
    }

    if (!supportMail || !supportNumber) {
      return res.status(400).json({
        success: false,
        message: 'Support email and phone are required'
      });
    }

    if (!shopLicenseNumber || !shopLicenseExpiry) {
      return res.status(400).json({
        success: false,
        message: 'Trade license number and expiry date are required'
      });
    }

    // if (!EmiratesId) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Emirates ID is required'
    //   });
    // }

    if (!taxRegistrationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Tax Registration Number (TRN) is required'
      });
    }

    if (!location || !shopAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shop location and address are required'
      });
    }

    // if (!bankName || !accountNumber || !ibanNumber) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Bank details (name, account number, IBAN) are required'
    //   });
    // }

    if (!shopLicenseImage || !EmiratesIdImage) {
      return res.status(400).json({
        success: false,
        message: 'Trade license and Emirates ID images are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // CHECK EXISTING
    // ═══════════════════════════════════════════════════════════════════

    const existingAdmin = await ShopAdmin.findOne({ email });

    if (existingAdmin) {
      console.log('❌ Shop already exists with email:', email);
      return res.status(400).json({
        success: false,
        message: 'Shop with this email already exists'
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // CREATE SHOP
    // ═══════════════════════════════════════════════════════════════════

    console.log('✅ Creating shop document...');

    const shop = await Shop.create({
      shopeDetails: {
        // Basic
        shopName: name,
        shopMail: email,
        shopContact: phone,
        supportMail: supportMail || email,
        supportNumber: supportNumber || phone,
        password, // Will be hashed by pre-save hook if exists

        // Legal & Licensing
        shopLicenseNumber,
        shopLicenseExpiry,
        EmiratesId,
        taxRegistrationNumber,

        // Location
        shopLocation: location, // "lat,lng"
        shopAddress,            // Full address
        city: emirates || city || 'Dubai',
        emirates: emirates || 'Dubai',

        // Documents
        shopLicenseImage,
        EmiratesIdImage,

        // Bank Details (nested object)
        shopBankDetails: {
         bankName: bankName || '',
  accountNumber: accountNumber || '',
  ibanNumber: ibanNumber || '',  // ← remove the `|| ibanNuber` fallback
  branch: branch || '',
  swiftCode: swiftCode || ''
        }
      },
      isVerified: false, // Start as unverified
      products: [],
      orders: []
    });

    console.log('✅ Shop created:', shop._id);

    // ═══════════════════════════════════════════════════════════════════
    // CREATE SHOP ADMIN
    // ═══════════════════════════════════════════════════════════════════

    console.log('✅ Creating shop admin...');

    const admin = await ShopAdmin.create({
      name,
      email,
      phone,
      password,
      countryCode: '+971',
      role: ROLES.SHOP_ADMIN,
      shopId: shop._id
    });

    console.log('✅ Shop admin created:', admin._id);

    // ═══════════════════════════════════════════════════════════════════
    // NOTIFY SUPER ADMIN
    // ═══════════════════════════════════════════════════════════════════

    try {
      await notifyRegistrationRequest('Shop', shop._id, name);
      console.log('✅ Super admin notified about new shop registration');
    } catch (notifErr) {
      console.warn('⚠️ Registration notification failed:', notifErr.message);
    }

    // ═══════════════════════════════════════════════════════════════════
    // GENERATE TOKEN
    // ═══════════════════════════════════════════════════════════════════

    const token = generateToken({ id: admin._id, role: ROLES.SHOP_ADMIN });

    console.log('✅ Shop registration completed successfully');
    console.log('═══════════════════════════════════════════════════════════');

    return res.status(201).json({
      success: true,
      message: 'Shop registered successfully. Awaiting admin verification.',
      data: {
        adminId: admin._id,
        shopId: shop._id,
        role: ROLES.SHOP_ADMIN,
        token,
        isVerified: false,
        shopDetails: {
          shopName: shop.shopeDetails.shopName,
          shopMail: shop.shopeDetails.shopMail,
          shopContact: shop.shopeDetails.shopContact,
          emirates: shop.shopeDetails.emirates,
          shopLicenseNumber: shop.shopeDetails.shopLicenseNumber
        }
      }
    });

  } catch (err) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ SHOP REGISTRATION ERROR');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    console.error('═══════════════════════════════════════════════════════════');

    return res.status(500).json({
      success: false,
      message: 'Shop registration failed',
      error: err.message
    });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET
// ─────────────────────────────────────────────────────────────────────────────

exports.forgotPassword = async (req, res) => {
  try {
    const { email, role } = req.body;
    console.log('========== FORGOT PASSWORD REQUEST ==========');
    console.log('Email:', email, '| Role:', role);

    if (!email || !role) {
      return res.status(400).json({ success: false, message: 'Email and role are required' });
    }

    if (!['SHOP_ADMIN', 'AGENCY'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Password reset is only available for Shop and Agency accounts' });
    }

    const Model = roleModelMap[role];
    if (!Model) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    let user;
    if (role === 'AGENCY') {
      const { DeliveryAgency } = require('../models/DeliveryAgency');
      user = await DeliveryAgency.findOne({
        $or: [
          { 'agencyDetails.email': email },
          { 'agencyDetails.agencyMail': email }
        ],
      });
    } else {
      user = await Model.findOne({ email });
    }

    // Same response whether user exists or not (prevents email enumeration)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a 6-digit OTP has been sent.'
      });
    }

    const resetOTP = String(crypto.randomInt(100000, 999999));
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.resetPasswordOTP = resetOTP;
    user.resetPasswordExpires = otpExpiry;
    await user.save();

   
    const emailSent = await sendOTPEmail(email, resetOTP, 'PreMart');
if (!emailSent) {
  console.warn('Password reset email failed via Resend');
  return res.status(503).json({
    success: false,
    message: 'Could not send OTP email. Please try again later.',
    data: { email }
  });
}

    console.log('✅ OTP email sent to:', email);
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset OTP has been sent to your email.',
      data: { email, expiresAt: otpExpiry }
    });

  } catch (err) {
    console.error('❌ Forgot Password Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process forgot password request', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, role } = req.body;
    console.log('========== RESET PASSWORD REQUEST ==========');
    console.log('Email:', email, '| Role:', role);

    if (!email || !otp || !newPassword || !role) {
      return res.status(400).json({ success: false, message: 'Email, OTP, new password, and role are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }
    if (!['SHOP_ADMIN', 'AGENCY'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Password reset is only available for Shop and Agency accounts' });
    }

    const Model = roleModelMap[role];
    if (!Model) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    let user;
    if (role === 'AGENCY') {
      const { DeliveryAgency } = require('../models/DeliveryAgency');
      user = await DeliveryAgency.findOne({
        $or: [
          { 'agencyDetails.email': email },
          { 'agencyDetails.agencyMail': email }
        ],
      });
    } else {
      user = await Model.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isValidOTP = user.resetPasswordOTP && String(user.resetPasswordOTP) === String(otp);
    if (!isValidOTP) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Agency password is NESTED; ShopAdmin password is TOP-LEVEL
    if (role === 'AGENCY') {
      user.agencyDetails.password = newPassword; // pre-save hook hashes this
    } else {
      user.password = newPassword; // pre-save hook hashes this
    }

    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log('✅ Password reset successfully for:', email);
    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (err) {
    console.error('❌ Reset Password Error:', err);
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

    if (visibility === undefined) {
      return res.status(400).json({ success: false, message: 'visibility (true/false) is required' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.accountVisibility = visibility;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Account visibility turned ${visibility ? 'ON' : 'OFF'} successfully`,
      data: { userId: user._id, accountVisibility: user.accountVisibility }
    });
  } catch (err) {
    console.error('Toggle Account Visibility Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update account visibility', error: err.message });
  }
};

exports.toggleShopVerification = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { isVerified } = req.body;

    if (isVerified === undefined) {
      return res.status(400).json({ success: false, message: 'isVerified (true/false) is required' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ success: false, message: 'Invalid shop ID' });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    shop.isVerified = isVerified;
    await shop.save();

    // ✅ NOTIFICATION: Send shop verification notification
    await notifyShopVerification(shop, isVerified);

    return res.status(200).json({
      success: true,
      message: `Shop ${isVerified ? 'verified' : 'unverified'} successfully`,
      data: { shopId: shop._id, shopName: shop.shopeDetails?.shopName, isVerified: shop.isVerified }
    });
  } catch (err) {
    console.error('❌ Toggle Shop Verification Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update shop verification status', error: err.message });
  }
};

exports.toggleAgencyVerification = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { isVerified } = req.body;

    if (isVerified === undefined) {
      return res.status(400).json({ success: false, message: 'isVerified (true/false) is required' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(agencyId)) {
      return res.status(400).json({ success: false, message: 'Invalid agency ID' });
    }

    const { DeliveryAgency } = require('../models/DeliveryAgency');
    const agency = await DeliveryAgency.findById(agencyId);

    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    agency.isVerified = isVerified;
    await agency.save();

    // ✅ NOTIFICATION: Send agency verification notification
    await notifyAgencyVerification(agency, isVerified);

    return res.status(200).json({
      success: true,
      message: `Agency ${isVerified ? 'verified' : 'unverified'} successfully`,
      data: {
        agencyId: agency._id,
        agencyName: agency.agencyDetails?.agencyName,
        isVerified: agency.isVerified
      }
    });
  } catch (err) {
    console.error('❌ Toggle Agency Verification Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update agency verification status', error: err.message });
  }
};

exports.rejectShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { rejectionReason } = req.body;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🚫 REJECT SHOP REQUEST');
    console.log('Shop ID:', shopId);
    console.log('Rejection Reason:', rejectionReason);
    console.log('═══════════════════════════════════════════════════════');

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid shop ID' 
      });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: 'Shop not found' 
      });
    }

    console.log('✅ Shop found:', shop.shopeDetails?.shopName);

    // ✅ FIX: Update nested fields inside shopeDetails
    shop.isVerified = false;
    shop.shopeDetails.rejectionReason = rejectionReason || 'No reason provided';
    shop.shopeDetails.rejectedAt = new Date();
    
    await shop.save();

    console.log('✅ Shop updated:');
    console.log('   - isVerified:', shop.isVerified);
    console.log('   - rejectionReason:', shop.shopeDetails.rejectionReason);
    console.log('   - rejectedAt:', shop.shopeDetails.rejectedAt);

    // Send rejection email
    const shopEmail = shop.shopeDetails?.shopMail;
    const shopName = shop.shopeDetails?.shopName;

    if (shopEmail) {
      const { sendShopRejectionEmail } = require('../services/emailService');
      sendShopRejectionEmail(shopEmail, shopName, rejectionReason)
        .then(sent => {
          if (sent) console.log('✅ Shop rejection email sent to:', shopEmail);
          else console.warn('⚠️ Shop rejection email failed');
        })
        .catch(e => console.warn('⚠️ Rejection email error:', e.message));
    }

    console.log('═══════════════════════════════════════════════════════');

    return res.status(200).json({
      success: true,
      message: `Shop rejected successfully${rejectionReason ? ' with reason provided' : ''}`,
      data: { 
        shopId: shop._id, 
        shopName: shop.shopeDetails?.shopName, 
        isVerified: shop.isVerified,
        rejectionReason: shop.shopeDetails.rejectionReason,
        rejectedAt: shop.shopeDetails.rejectedAt
      }
    });
  } catch (err) {
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ REJECT SHOP ERROR');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    console.error('═══════════════════════════════════════════════════════');
    
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to reject shop', 
      error: err.message 
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REJECT AGENCY (FIXED)
// ─────────────────────────────────────────────────────────────────────────────

exports.rejectAgency = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { rejectionReason } = req.body;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🚫 REJECT AGENCY REQUEST');
    console.log('Agency ID:', agencyId);
    console.log('Rejection Reason:', rejectionReason);
    console.log('═══════════════════════════════════════════════════════');

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(agencyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid agency ID' 
      });
    }

    const { DeliveryAgency } = require('../models/DeliveryAgency');
    const agency = await DeliveryAgency.findById(agencyId);

    if (!agency) {
      return res.status(404).json({ 
        success: false, 
        message: 'Agency not found' 
      });
    }

    console.log('✅ Agency found:', agency.agencyDetails?.agencyName);

    // ✅ FIX: Update nested fields inside agencyDetails
    agency.isVerified = false;
    agency.agencyDetails.rejectionReason = rejectionReason || 'No reason provided';
    agency.agencyDetails.rejectedAt = new Date();
    
    await agency.save();

    console.log('✅ Agency updated:');
    console.log('   - isVerified:', agency.isVerified);
    console.log('   - rejectionReason:', agency.agencyDetails.rejectionReason);
    console.log('   - rejectedAt:', agency.agencyDetails.rejectedAt);

    // Send rejection email
    const agencyEmail = agency.agencyDetails?.agencyMail || agency.agencyDetails?.email;
    const agencyName = agency.agencyDetails?.agencyName;

    if (agencyEmail) {
      const { sendAgencyRejectionEmail } = require('../services/emailService');
      sendAgencyRejectionEmail(agencyEmail, agencyName, rejectionReason)
        .then(sent => {
          if (sent) console.log('✅ Agency rejection email sent to:', agencyEmail);
          else console.warn('⚠️ Agency rejection email failed');
        })
        .catch(e => console.warn('⚠️ Rejection email error:', e.message));
    }

    console.log('═══════════════════════════════════════════════════════');

    return res.status(200).json({
      success: true,
      message: `Agency rejected successfully${rejectionReason ? ' with reason provided' : ''}`,
      data: {
        agencyId: agency._id,
        agencyName: agency.agencyDetails?.agencyName,
        isVerified: agency.isVerified,
        rejectionReason: agency.agencyDetails.rejectionReason,
        rejectedAt: agency.agencyDetails.rejectedAt
      }
    });
  } catch (err) {
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ REJECT AGENCY ERROR');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    console.error('═══════════════════════════════════════════════════════');
    
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to reject agency', 
      error: err.message 
    });
  }
};