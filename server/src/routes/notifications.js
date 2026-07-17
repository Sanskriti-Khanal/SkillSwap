const express = require('express');
const authMiddleware = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();
router.use(authMiddleware);

// @route   GET /api/notifications
// @desc    List the caller's notifications, newest first.
// @access  Private
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { user_id: req.user.id };
    if (req.query.unread === 'true') filter.read = false;

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments({ user_id: req.user.id, read: false }),
      Notification.countDocuments(filter),
    ]);

    res.json({ notifications, unreadCount, currentPage: page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/notifications/:id/read
// @desc    Mark one notification as read.
// @access  Private
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!notification) return res.status(404).json({ msg: 'Notification not found' });

    notification.read = true;
    notification.read_at = new Date();
    await notification.save();

    res.json(notification);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Notification not found' });
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/notifications/read-all
// @desc    Mark all of the caller's notifications as read.
// @access  Private
router.patch('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { user_id: req.user.id, read: false },
      { $set: { read: true, read_at: new Date() } }
    );
    res.json({ msg: 'All notifications marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
