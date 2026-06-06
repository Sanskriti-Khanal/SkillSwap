module.exports = function (...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const userRole = req.user.role;

    // Admin has access to everything
    if (userRole === 'admin') {
      return next();
    }

    // 'both' acts as both 'learner' and 'tutor'
    if (userRole === 'both') {
      if (allowedRoles.includes('learner') || allowedRoles.includes('tutor')) {
        return next();
      }
    }

    // Direct role match
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ msg: 'Forbidden: Insufficient permissions' });
  };
};
