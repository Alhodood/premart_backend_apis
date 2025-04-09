const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to check if user is authenticated
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, token missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // user info is now available in req.user
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Middleware to restrict access to admin roles only
const adminOnly = async (req, res, next) => {
  if (!req.user || (req.user.role !== 'super-admin' && req.user.role !== 'shop-admin')) {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }
  next();
};

module.exports = { protect, adminOnly };