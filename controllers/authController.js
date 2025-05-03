const jwt = require('jsonwebtoken');
const User = require('../models/User');
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRE = '7d';

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, password, countryCode, dob, role } = req.body;

    // Basic validation
    if (!name || !email || !phone || !password || !countryCode) {
      return res.status(400).json({
        message: 'All required fields must be provided',
        success: false
      });
    }

    // Check if user exists
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(409).json({
        message: 'Email or phone already registered',
        success: false
      });
    }

    const newUser = new User({
      name,
      email,
      phone,
      password,
      countryCode,
      dob,
      role // defaults to customer if not passed
    });

    await newUser.save();

    return res.status(201).json({
      message: 'User registered successfully',
      success: true,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      message: 'Registration failed',
      success: false,
      data: error.message
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        success: false
      });
    }

    // 🔍 Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    // 🔐 Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid password',
        success: false
      });
    }

    return res.status(200).json({
      message: 'Login successful',
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      message: 'Login failed',
      success: false,
      data: error.message
    });
  }
};

//// OTP



//OTP LOGIN AND REGISTER through twilio
exports.sendOtp = async (req, res) => {
  const { phone, role } = req.body;

  if (!phone || !role) return res.status(400).json({ message: 'Phone and role are required' });

  try {
    let user = await User.findOne({ phone });
    if (!user) {
      // Auto-register new user
      user = new User({
        name: 'New User',
        phone,
        password: 'Temp@1234',
        countryCode: '+971',
        role
      });
      await user.save();
    }

    await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phone, channel: 'sms' });

    res.status(200).json({ message: 'OTP sent', success: true });
  } catch (err) {
    res.status(500).json({ message: 'OTP send failed', success: false, error: err.message });
  }
};

// ✅ Verify OTP
exports.verifyOtp = async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) return res.status(400).json({ message: 'Phone and OTP are required' });

  try {
    const verification = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks
      .create({ to: phone, code });

    if (verification.status === 'approved') {
      const user = await User.findOne({ phone });
      if (!user) return res.status(404).json({ message: 'User not found' });

      const token = generateToken(user);
      res.status(200).json({
        message: 'OTP verified. Login successful',
        success: true,
        token,
        user
      });
    } else {
      res.status(401).json({ message: 'Invalid OTP', success: false });
    }
  } catch (err) {
    res.status(500).json({ message: 'OTP verification failed', success: false, error: err.message });
  }
};


exports.resendOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register.' });
    }

    await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phone, channel: 'sms' });

    res.status(200).json({ message: 'OTP resent successfully', success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to resend OTP', success: false, error: err.message });
  }
};