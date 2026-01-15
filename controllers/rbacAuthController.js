const jwt = require('jsonwebtoken');
const roleModelMap = require('../constants/roleModelMap');
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