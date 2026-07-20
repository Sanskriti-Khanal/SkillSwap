const express = require('express');
const { body, validationResult } = require('express-validator');
const BlockedIP = require('../models/BlockedIP');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const User = require('../models/User');
const SecurityAlert = require('../models/SecurityAlert');
const { logEvent, verifyAuditChain } = require('../services/logger');
const auditAction = require('../middleware/auditAction');

const router = express.Router();

// Protect all admin routes
router.use(authMiddleware, requireRole('admin'));

// @route   POST /api/admin/block-ip
// @desc    Block an IP address
// @access  Private/Admin
router.post('/block-ip', auditAction('admin.ip_blocked', 'BlockedIP'), [
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
    res.locals.audit.resourceId = blocked._id;
    res.locals.audit.metadata = { blockedIp: ip_address, reason };
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
router.patch('/users/:id/role', auditAction('admin.role_changed', 'User'), [
  body('role', 'Valid role is required').isIn(['learner', 'tutor', 'both', 'admin'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'User not found' });
    }

    const previousRole = user.role;
    user.role = req.body.role;
    await user.save();

    res.locals.audit.metadata = { previousRole, newRole: user.role };
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
      logEvent(req.user.id, 'admin.audit_chain_tampered', {
        ipAddress: req.ip, role: req.user.role, resource: 'AuditLog', resourceId: result.brokenAt, status: 'failure',
      });
      return res.status(200).json({ valid: false, message: `Chain integrity broken at sequence ${result.brokenAt}` });
    }
    res.json({ valid: true, totalEntries: result.totalEntries, message: 'Audit log chain is intact' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/security-alerts
// @desc    Paginated suspicious-activity alerts, newest first. Filterable by
//          status/type/severity — the admin dashboard's default view is
//          status=open so resolved alerts don't clutter the triage queue.
// @access  Private/Admin
router.get('/security-alerts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.severity) filter.severity = req.query.severity;

    const [alerts, total, openCount] = await Promise.all([
      SecurityAlert.find(filter)
        .populate('userId', 'email role')
        .populate('resolved_by', 'email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SecurityAlert.countDocuments(filter),
      SecurityAlert.countDocuments({ status: 'open' }),
    ]);

    res.json({ alerts, currentPage: page, totalPages: Math.ceil(total / limit), total, openCount });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/security-alerts/:id/resolve
// @desc    Mark an alert as reviewed/handled.
// @access  Private/Admin
router.patch('/security-alerts/:id/resolve', auditAction('admin.security_alert_resolved', 'SecurityAlert'), async (req, res) => {
  try {
    const alert = await SecurityAlert.findById(req.params.id);
    if (!alert) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Alert not found' });
    }

    alert.status = 'resolved';
    alert.resolved_by = req.user.id;
    alert.resolved_at = new Date();
    await alert.save();

    res.locals.audit.metadata = { alertType: alert.type };
    res.json({ msg: 'Alert resolved', alert });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Alert not found' });
    res.status(500).send('Server Error');
  }
});

module.exports = router;

