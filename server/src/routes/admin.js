const express = require('express');
const { body, validationResult } = require('express-validator');
const BlockedIP = require('../models/BlockedIP');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Basic admin check middleware (for this exercise, assuming user has an isAdmin field or similar. Since we don't have it, we just check a mock condition or add it on the fly. Let's assume we add an `role` field to User later. For now, we simulate).
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.email !== 'admin@skillswap.com') { // Hardcoded admin check for demonstration since role isn't defined
      return res.status(403).json({ msg: 'Admin role required' });
    }
    next();
  } catch (err) {
    res.status(500).send('Server Error');
  }
};

// @route   POST /api/admin/block-ip
// @desc    Block an IP address
// @access  Private/Admin
router.post('/block-ip', [
  authMiddleware,
  adminMiddleware,
  body('ip_address', 'IP address is required').not().isEmpty(),
  body('reason', 'Reason is required').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  const { ip_address, reason } = req.body;

  try {
    let blocked = await BlockedIP.findOne({ ip_address });
    if (blocked) {
      return res.status(400).json({ msg: 'IP is already blocked' });
    }

    blocked = new BlockedIP({
      ip_address,
      reason,
      blocked_by: req.user.id
    });

    await blocked.save();
    res.json({ msg: 'IP blocked successfully', blocked });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
