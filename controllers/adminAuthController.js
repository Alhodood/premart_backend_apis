const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Shop } = require('../models/Shop');
const{
  ShopAdmin,
  SuperAdmin
} = require('../models/AdminAuth');
const twilio = require('twilio');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Replace for production
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);





// 🔹 Super Admin Register
exports.registerSuperAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, countryCode, dob } = req.body;

    const existing = await SuperAdmin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered', success: false });
    }

    const newUser = new SuperAdmin({
      name,
      email,
      phone,
      password,
      countryCode,
      dob,
      role: 'superAdmin' 
    });

    await newUser.save();

    res.status(201).json({
      message: 'Super Admin registered successfully',
      success: true,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', success: false, error: err.message });
  }
};

// 🔹 Super Admin Login
exports.loginSuperAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await SuperAdmin.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Super Admin not found', success: false });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password', success: false });
    }

    res.status(200).json({
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
  } catch (err) {
    res.status(500).json({ message: 'Login failed', success: false, error: err.message });
  }
};

// 🔹 Shop Admin Register
exports.registerShopAdmin = async (req, res) => {
  try {
    const {
      name, email, phone, password, countryCode, dob, address, role,
      location, emiratesIdImage, companyLicenseImage
    } = req.body;

    const existing = await ShopAdmin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered', success: false });
    }

    const newShopAdmin = new ShopAdmin({
      name, email, phone, password, countryCode, dob,
      address, role, location, emiratesIdImage, companyLicenseImage
    });

    await newShopAdmin.save();

    res.status(201).json({ message: 'Shop Admin registered successfully', success: true, data: newShopAdmin });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', success: false, error: err.message });
  }
};

// 🔹 Shop Admin Login



exports.loginShopAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const shop = await Shop.findOne({ 'shopeDetails.shopMail': email });
   
    if (!shop || !shop.shopeDetails) {
      return res.status(404).json({ message: 'Shop not found', success: false });
    }

    // if (shop.shopeDetails.password !== password) {
    //   return res.status(401).json({ message: 'Incorrect password', success: false });
    // }

    return res.status(200).json({
      message: 'Login successful',
      success: true,
      data: {
        shopId: shop._id,
        shopName: shop.shopeDetails.shopName,
        shopMail: shop.shopeDetails.shopMail,
        shopContact: shop.shopeDetails.shopContact,
        supportMail: shop.shopeDetails.supportMail,
        supportNumber: shop.shopeDetails.supportNumber,
        shopAddress: shop.shopeDetails.shopAddress,
        location: shop.shopeDetails.shopLocation,
        licenseNumber: shop.shopeDetails.shopLicenseNumber,
        licenseExpiry: shop.shopeDetails.shopLicenseExpiry,
        emiratesId: shop.shopeDetails.EmiratesId,
        bankDetails: shop.shopeDetails.shopBankDetails,
        role: 'shopAdmin'
      }
    });

  } catch (err) {
    console.error('Shop Login Error:', err);
    return res.status(500).json({
      message: 'Login failed',
      success: false,
      error: err.message
    });
  }
};


