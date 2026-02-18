// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Token missing' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // { id, role }
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

/** Sets req.user when valid JWT present; does not fail when missing (for optional auth). */
exports.optionalProtect = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    next();
  }
};

exports.mustBeOwner = (paramKey = 'userId') => {
  return (req, res, next) => {
    if (req.user.role === 'SUPER_ADMIN') return next();

    if (req.user.id !== req.params[paramKey]) {
      return res.status(403).json({ message: 'Forbidden: Ownership violation' });
    }

    next();
  };
};