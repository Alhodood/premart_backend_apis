const jwt = require('jsonwebtoken');
const roleModelMap = require('../constants/roleModelMap');

const User = require('../models/User');
const { ROLES } = require('../constants/roles');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = '7d';

const generateToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });

exports.register = async (req, res) => {
  try {
    const { role, ...payload } = req.body;
    if ([ROLES.SUPER_ADMIN, ROLES.SHOP_ADMIN, ROLES.AGENCY].includes(role)) {
  return res.status(403).json({ message: 'Role cannot be self-registered' });
}

    if (!role || !roleModelMap[role]) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const Model = roleModelMap[role];

    const exists = await Model.findOne({ email: payload.email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Already registered' });
    }

    const user = await Model.create({ ...payload, role });

    const token = generateToken({ id: user._id, role });

    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      data: { id: user._id, role, token }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!role || !roleModelMap[role]) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const Model = roleModelMap[role];
    const user = await Model.findOne({ email });

    if (!user || !user.comparePassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken({ id: user._id, role });

    res.json({
      success: true,
      message: 'Login successful',
      data: { id: user._id, role, token }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { phone, code, role } = req.body;

    if (![ROLES.CUSTOMER, ROLES.DELIVERY_BOY].includes(role)) {
  return res.status(403).json({ message: 'OTP login not allowed for this role' });
}

    if (!role || !roleModelMap[role]) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const Model = roleModelMap[role];

    // DEV bypass
    if (code !== '123456') {
      return res.status(401).json({ success: false, message: 'Invalid OTP (DEV MODE)' });
    }

    let user = await Model.findOne({ phone });

    if (!user) {
      user = await Model.create({ phone, role });
    }

    const token = jwt.sign(
      { id: user._id, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'OTP login success',
      data: { id: user._id, role, token }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

    // prevent duplicates
    const exists = await Model.findOne({ email });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Super admin already exists with this email'
      });
    }

    const admin = await Model.create({
      name,
      email,
      password,
      phone,
      countryCode,
      role: ROLES.SUPER_ADMIN
    });

    const token = generateToken({
      id: admin._id,
      role: ROLES.SUPER_ADMIN
    });

    res.status(201).json({
      success: true,
      message: 'Super admin created successfully',
      data: {
        id: admin._id,
        role: ROLES.SUPER_ADMIN,
        token
      }
    });

  } catch (err) {
    console.error('Create SuperAdmin Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

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

      // First address for table
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
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      data: err.message
    });
  }
};

exports.createShopAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const Model = roleModelMap[ROLES.SHOP_ADMIN];

    if (!Model) {
      return res.status(500).json({ success: false, message: 'ShopAdmin model not registered in roleModelMap' });
    }

    const exists = await Model.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Already exists' });
    }

    const admin = await Model.create({
      name,
      email,
      password,
      phone,
      role: ROLES.SHOP_ADMIN
    });

    res.status(201).json({
      success: true,
      message: 'Shop admin created successfully',
      data: admin
    });

  } catch (err) {
    console.error('Create Shop Admin Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};