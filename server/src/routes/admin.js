const express = require('express');
const { body, validationResult } = require('express-validator');
const BlockedIP = require('../models/BlockedIP');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const User = require('../models/User');
const { logEvent, verifyAuditChain } = require('../services/logger');

const router = express.Router();

// Protect all admin routes
router.use(authMiddleware, requireRole('admin'));

// @route   POST /api/admin/block-ip
// @desc    Block an IP address
// @access  Private/Admin
router.post('/block-ip', [
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
    logEvent(req.user.id, 'admin.ip_blocked', { ipAddress: req.ip, blockedIp: ip_address, reason });
    res.json({ msg: 'IP blocked successfully', blocked });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/users
// @desc    Get paginated list of all users
// @access  Private/Admin
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password_hash -mfa_secret -__v')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/users/:id/role
// @desc    Change a user's role
// @access  Private/Admin
router.patch('/users/:id/role', [
  body('role', 'Valid role is required').isIn(['learner', 'tutor', 'both', 'admin'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const previousRole = user.role;
    user.role = req.body.role;
    await user.save();

    logEvent(req.user.id, 'admin.role_changed', {
      ipAddress: req.ip,
      targetUserId: user._id,
      previousRole,
      newRole: user.role,
    });
    res.json({ msg: 'User role updated successfully', role: user.role });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/audit-chain/verify
// @desc    Verify tamper-evident audit log chain integrity
// @access  Private/Admin
router.get('/audit-chain/verify', async (req, res) => {
  try {
    const result = await verifyAuditChain();
    if (!result.valid) {
      logEvent(req.user.id, 'admin.audit_chain_tampered', { ipAddress: req.ip, brokenAt: result.brokenAt });
      return res.status(200).json({ valid: false, message: `Chain integrity broken at sequence ${result.brokenAt}` });
    }
    res.json({ valid: true, totalEntries: result.totalEntries, message: 'Audit log chain is intact' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

