// @deprecated — replaced by unified role-based auth in authController.js
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const twilio = require('twilio');
const { ROLES } = require('../../constants/roles');
const logger = require('../../config/logger');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRE = '7d';

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

// ===========================
// REGISTER
// ===========================
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    logger.info('registerUser: request received', { email });

    if (!email || !password) {
      logger.warn('registerUser: email or password missing');
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      logger.warn('registerUser: user already exists', { email });
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({ name, email, phone, password, role: role || ROLES.CUSTOMER });
    const token = generateToken(user);

    logger.info('registerUser: user registered successfully', { id: user._id, email });
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, token }
    });
  } catch (err) {
    logger.error('registerUser: failed to register user', { error: err });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===========================
// LOGIN
// ===========================
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    logger.info('loginUser: request received', { email });

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn('loginUser: invalid credentials - user not found', { email });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      logger.warn('loginUser: invalid credentials - wrong password', { email });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    logger.info('loginUser: login successful', { id: user._id, email });
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, profileImage: user.profileImage, token }
    });
  } catch (err) {
    logger.error('loginUser: failed to login', { error: err });
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete Account
exports.deletAddcount = async (req, res) => {
  const _id = req.params.userId;
  try {
    logger.info('deletAddcount: request received', { userId: _id });

    const user = await User.findOne({ _id });
    if (!user) {
      logger.warn('deletAddcount: user not found', { userId: _id });
      return res.status(200).json({ message: 'user not founded. please enter valid phone number', success: false, data: [] });
    }

    user.accountVisibility = false;
    await user.save();

    logger.info('deletAddcount: account deleted successfully', { userId: _id });
    res.status(200).json({ message: 'Your account is deleted', success: true, data: user });
  } catch (err) {
    logger.error('deletAddcount: failed to delete account', { error: err });
    res.status(500).json({ message: 'Somthing went wrong', success: false, error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    logger.info('getProfile: request received', { userId });

    if (!userId) {
      logger.warn('getProfile: userId param missing');
      return res.status(400).json({ message: 'userId param is required', success: false });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      logger.warn('getProfile: user not found', { userId });
      return res.status(404).json({ message: 'User not found', success: false });
    }

    logger.info('getProfile: profile fetched successfully', { userId });
    res.status(200).json({ message: 'Profile details successfully', success: true, data: user });
  } catch (err) {
    logger.error('getProfile: failed to fetch profile', { error: err });
    res.status(500).json({ message: 'Failed to fetch profile', success: false, error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    logger.info('updateProfile: request received', { userId });

    if (!userId) {
      logger.warn('updateProfile: userId param missing');
      return res.status(400).json({ message: 'userId param is required', success: false });
    }

    const { name, email, phone, dob, profileImage } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      logger.warn('updateProfile: user not found', { userId });
      return res.status(404).json({ message: 'User not found', success: false });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (dob) user.dob = dob;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (phone && phone !== user.phone) {
      user.accountVerify = false;
      user.phone = phone;
    }

    await user.save();

    logger.info('updateProfile: profile updated successfully', { userId });
    res.status(200).json({
      message: 'Profile updated successfully',
      success: true,
      data: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, accountStatus: user.accountVerify, dob: user.dob, profileImage: user.profileImage }
    });
  } catch (err) {
    logger.error('updateProfile: failed to update profile', { error: err });
    res.status(500).json({ message: 'Failed to update profile', success: false, error: err.message });
  }
};

// ===========================
// ADDRESS CRUD
// ===========================
exports.updateUserAddress = async (req, res) => {
  try {
    const { id: userId, addressId } = req.params;
    const updateData = req.body;
    logger.info('updateUserAddress: request received', { userId, addressId });

    const user = await User.findById(userId);
    if (!user) {
      logger.warn('updateUserAddress: user not found', { userId });
      return res.status(404).json({ message: 'User not found', success: false });
    }

    let addressFound = false;
    for (let i = 0; i < user.address.length; i++) {
      if (user.address[i]._id.toString() === addressId) {
        if (updateData.default === true) {
          user.address.forEach((addr, index) => { user.address[index].default = false; });
        }
        user.address[i] = { ...user.address[i]._doc, ...updateData };
        addressFound = true;
        break;
      }
    }

    if (!addressFound) {
      logger.warn('updateUserAddress: address not found', { userId, addressId });
      return res.status(404).json({ message: 'Address not found', success: false });
    }

    const updatedUser = await user.save();

    logger.info('updateUserAddress: address updated successfully', { userId, addressId });
    res.status(200).json({ message: 'Address updated successfully', success: true, data: updatedUser.address });
  } catch (error) {
    logger.error('updateUserAddress: failed to update address', { error });
    res.status(500).json({ message: 'Failed to update address', success: false, error: error.message });
  }
};

exports.addNewAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const newAddress = req.body;
    logger.info('addNewAddress: request received', { userId });

    const user = await User.findById(userId);
    if (!user) {
      logger.warn('addNewAddress: user not found', { userId });
      return res.status(200).json({ message: 'User not found', success: false });
    }

    user.address.push(newAddress);
    await user.save();

    logger.info('addNewAddress: address added successfully', { userId });
    res.status(200).json({ success: true, message: 'Address added successfully', data: user.address });
  } catch (error) {
    logger.error('addNewAddress: failed to add address', { error });
    res.status(500).json({ message: 'Failed to add address', success: false, error: error.message });
  }
};

exports.deleteAddressById = async (req, res) => {
  try {
    const { id: userId, addressId } = req.params;
    logger.info('deleteAddressById: request received', { userId, addressId });

    const user = await User.findById(userId);
    if (!user) {
      logger.warn('deleteAddressById: user not found', { userId });
      return res.status(200).json({ message: 'User not found', success: false });
    }

    const originalLength = user.address.length;
    user.address = user.address.filter((addr) => addr._id.toString() !== addressId);

    if (user.address.length === originalLength) {
      logger.warn('deleteAddressById: address not found', { userId, addressId });
      return res.status(200).json({ message: 'Address not found', success: false });
    }

    await user.save();

    logger.info('deleteAddressById: address deleted successfully', { userId, addressId });
    res.status(200).json({ success: true, message: 'Address deleted successfully', data: user.address });
  } catch (error) {
    logger.error('deleteAddressById: failed to delete address', { error });
    res.status(500).json({ message: 'Failed to delete address', success: false, error: error.message });
  }
};

exports.getAllAddresses = async (req, res) => {
  try {
    const userId = req.params.id;
    logger.info('getAllAddresses: request received', { userId });

    const user = await User.findById(userId).select('address');
    if (!user) {
      logger.warn('getAllAddresses: user not found', { userId });
      return res.status(404).json({ message: 'User not found', success: false });
    }

    logger.info('getAllAddresses: addresses fetched successfully', { userId, count: user.address.length });
    res.status(200).json({ success: true, message: 'Addresses fetched successfully', data: user.address });
  } catch (error) {
    logger.error('getAllAddresses: failed to fetch addresses', { error });
    res.status(500).json({ message: 'Failed to fetch addresses', success: false, error: error.message });
  }
};

exports.getDefultAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    logger.info('getDefultAddress: request received', { userId });

    const user = await User.findById(userId);
    if (!user) {
      logger.warn('getDefultAddress: user not found', { userId });
      return res.status(404).json({ message: 'User not found', success: false });
    }

    const defaultAddress = user.address.find(addr => addr.default === true);

    logger.info('getDefultAddress: default address fetched', { userId, found: !!defaultAddress });
    return res.status(200).json({ success: true, message: 'Default address fetched successfully', data: defaultAddress ? defaultAddress : [] });
  } catch (error) {
    logger.error('getDefultAddress: failed to fetch default address', { error });
    res.status(500).json({ message: 'Failed to fetch address', success: false, data: error.message });
  }
};

// ===========================
// CARD CRUD
// ===========================
exports.updateUserCard = async (req, res) => {
  try {
    const { id: userId, cardId } = req.params;
    const updateData = req.body;
    logger.info('updateUserCard: request received', { userId, cardId });

    const user = await User.findById(userId);
    if (!user) {
      logger.warn('updateUserCard: user not found', { userId });
      return res.status(404).json({ message: 'User not found', success: false });
    }

    let cardFound = false;
    for (let i = 0; i < user.card.length; i++) {
      if (user.card[i]._id.toString() === cardId) {
        user.card[i] = { ...user.card[i]._doc, ...updateData };
        cardFound = true;
        break;
      }
    }

    if (!cardFound) {
      logger.warn('updateUserCard: card not found', { userId, cardId });
      return res.status(404).json({ message: 'Card not found', success: false });
    }

    const updatedUser = await user.save();

    logger.info('updateUserCard: card updated successfully', { userId, cardId });
    res.status(200).json({ message: 'Address updated successfully', success: true, data: updatedUser.card });
  } catch (error) {
    logger.error('updateUserCard: failed to update card', { error });
    res.status(500).json({ message: 'Failed to update address', success: false, error: error.message });
  }
};

exports.addNewCard = async (req, res) => {
  try {
    const userId = req.params.id;
    const newCard = req.body;
    logger.info('addNewCard: request received', { userId });

    const user = await User.findById(userId);
    if (!user) {
      logger.warn('addNewCard: user not found', { userId });
      return res.status(200).json({ message: 'User not found', success: false });
    }

    user.card.push(newCard);
    await user.save();

    logger.info('addNewCard: card added successfully', { userId });
    res.status(200).json({ success: true, message: 'Card added successfully', data: user.card });
  } catch (error) {
    logger.error('addNewCard: failed to add card', { error });
    res.status(500).json({ message: 'Failed to add card', success: false, error: error.message });
  }
};

exports.deleteCardById = async (req, res) => {
  try {
    const { id: userId, cardId } = req.params;
    logger.info('deleteCardById: request received', { userId, cardId });

    const user = await User.findById(userId);
    if (!user) {
      logger.warn('deleteCardById: user not found', { userId });
      return res.status(200).json({ message: 'User not found', success: false });
    }

    const originalLength = user.card.length;
    user.card = user.card.filter((card) => card._id.toString() !== cardId);

    if (user.card.length === originalLength) {
      logger.warn('deleteCardById: card not found', { userId, cardId });
      return res.status(200).json({ message: 'Card not found', success: false });
    }

    await user.save();

    logger.info('deleteCardById: card deleted successfully', { userId, cardId });
    res.status(200).json({ success: true, message: 'Card deleted successfully', data: user.card });
  } catch (error) {
    logger.error('deleteCardById: failed to delete card', { error });
    res.status(500).json({ message: 'Failed to delete card', success: false, error: error.message });
  }
};

exports.getAllCard = async (req, res) => {
  try {
    const userId = req.params.id;
    logger.info('getAllCard: request received', { userId });

    const user = await User.findById(userId).select('card');
    if (!user) {
      logger.warn('getAllCard: user not found', { userId });
      return res.status(404).json({ message: 'User not found', success: false });
    }

    logger.info('getAllCard: cards fetched successfully', { userId, count: user.card.length });
    res.status(200).json({ success: true, message: 'Card fetched successfully', data: user.card });
  } catch (error) {
    logger.error('getAllCard: failed to fetch cards', { error });
    res.status(500).json({ message: 'Failed to fetch card', success: false, error: error.message });
  }
};

// ===========================
// OTP FLOWS
// ===========================
exports.sendOtpToCustomer = async (req, res) => {
  const { phone } = req.body;
  logger.info('sendOtpToCustomer: request received', { phone });

  if (!phone) {
    logger.warn('sendOtpToCustomer: phone missing');
    return res.status(400).json({ message: 'Phone is required', success: false });
  }

  try {
    await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phone, channel: 'sms' });

    logger.info('sendOtpToCustomer: OTP sent successfully', { phone });
    return res.status(200).json({ message: 'OTP sent successfully', success: true });
  } catch (err) {
    logger.error('sendOtpToCustomer: failed to send OTP', { error: err });
    res.status(500).json({ message: 'Failed to send OTP', success: false, error: err.message });
  }
};

exports.resendOtpToCustomer = async (req, res) => {
  const { phone } = req.body;
  logger.info('resendOtpToCustomer: request received', { phone });

  if (!phone) {
    logger.warn('resendOtpToCustomer: phone missing');
    return res.status(400).json({ message: 'Phone is required', success: false });
  }

  try {
    await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phone, channel: 'sms' });

    logger.info('resendOtpToCustomer: OTP resent successfully', { phone });
    return res.status(200).json({ message: 'OTP resent successfully', success: true });
  } catch (err) {
    logger.error('resendOtpToCustomer: failed to resend OTP', { error: err });
    res.status(500).json({ message: 'Failed to resend OTP', success: false, error: err.message });
  }
};

exports.verifyOtpForCustomer = async (req, res) => {
  const { phone, code } = req.body;
  logger.info('verifyOtpForCustomer: request received', { phone });

  if (!phone || !code) {
    logger.warn('verifyOtpForCustomer: phone or code missing');
    return res.status(400).json({ message: 'Phone and OTP code are required', success: false });
  }

  try {
    // ✅ 1. Bypass Twilio if fallback OTP is used
    if (code === '311299') {
      logger.warn('verifyOtpForCustomer: fallback OTP used', { phone });
      let user = await User.findOne({ phone });
      if (!user) {
        user = new User({ phone, accountVerify: true, role: 'customer', password: phone });
        await user.save();
      } else {
        user.accountVerify = true;
        await user.save();
      }
      const token = generateToken(user);
      logger.info('verifyOtpForCustomer: verified via fallback OTP', { userId: user._id });
      return res.status(200).json({
        message: 'OTP verified successfully (test override)',
        success: true,
        data: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, accountStatus: user.accountVerify, dob: user.dob, token }
      });
    }

    // ✅ 2. Normal Twilio verification
    const verification = await client.verify.v2
      .services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks
      .create({ to: phone, code });

    if (verification.status === 'approved') {
      let user = await User.findOne({ phone });
      if (!user) {
        user = new User({ phone, accountVerify: true, role: 'customer', password: phone });
        await user.save();
      } else {
        user.accountVerify = true;
        await user.save();
      }
      const token = generateToken(user);
      logger.info('verifyOtpForCustomer: OTP verified successfully', { userId: user._id, phone });
      return res.status(200).json({
        message: 'OTP verified successfully',
        success: true,
        data: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, accountStatus: user.accountVerify, dob: user.dob, token }
      });
    } else {
      logger.warn('verifyOtpForCustomer: invalid OTP', { phone });
      return res.status(401).json({ message: 'Invalid OTP', success: false });
    }
  } catch (err) {
    logger.error('verifyOtpForCustomer: OTP verification failed', { error: err });
    res.status(500).json({ message: 'OTP verification failed', success: false, error: err.message });
  }
};

// ===========================
// GET ALL USERS
// ===========================
exports.getAllUsers = async (req, res) => {
  try {
    logger.info('getAllUsers: request received');

    const users = await User.find().select('-password');
    const simplifiedUsers = users.map(user => {
      const defaultAddress = user.address?.find(addr => addr.default === true);
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        accountVisibility: user.accountVisibility,
        dob: user.dob,
        accountVerify: user.accountVerify,
        area: defaultAddress?.area || '',
        place: defaultAddress?.place || '',
        createdAt: user.createdAt
      };
    });

    logger.info('getAllUsers: users fetched successfully', { count: simplifiedUsers.length });
    res.status(200).json({ success: true, message: 'Users fetched successfully', data: simplifiedUsers });
  } catch (error) {
    logger.error('getAllUsers: failed to fetch users', { error });
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
};