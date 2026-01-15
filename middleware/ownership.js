exports.mustBeOwner = (paramKey = 'shopId') => {
  return (req, res, next) => {
    if (req.user.role === 'SUPER_ADMIN') return next();

    if (req.user.id !== req.params[paramKey]) {
      return res.status(403).json({ message: 'Forbidden: Ownership violation' });
    }

    next();
  };
};