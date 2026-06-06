const express = require('express');
const { body, validationResult } = require('express-validator');
const xss = require('xss-clean');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const Listing = require('../models/Listing');

const router = express.Router();

// Apply XSS sanitizer to all inputs in this router
router.use(xss());

// @route   POST /api/listings
// @desc    Create a skill listing
// @access  Private (tutor only)
router.post('/', [
  authMiddleware,
  requireRole('tutor', 'both'), // admin is automatically allowed by RBAC
  body('title', 'Title is required').not().isEmpty(),
  body('description', 'Description is required').not().isEmpty(),
  body('skill_category', 'Category is required').not().isEmpty(),
  body('price_per_session', 'Valid price required').isNumeric(),
  body('duration_minutes', 'Valid duration required').isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    const { title, description, skill_category, price_per_session, duration_minutes } = req.body;

    const listing = new Listing({
      tutor_id: req.user.id,
      title,
      description,
      skill_category,
      price_per_session,
      duration_minutes
    });

    await listing.save();
    res.status(201).json(listing);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/listings
// @desc    Get paginated listings
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.skill_category) {
      query.skill_category = req.query.skill_category;
    }

    const listings = await Listing.find(query)
      .populate('tutor_id', 'profile_photo_url bio email role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Listing.countDocuments(query);

    res.json({
      listings,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalListings: total
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/listings/:id
// @desc    Get a single listing by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('tutor_id', 'profile_photo_url bio email');
    if (!listing) return res.status(404).json({ msg: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Listing not found' });
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/listings/:id
// @desc    Update a listing
// @access  Private (tutor only, owner only)
router.patch('/:id', [authMiddleware, requireRole('tutor', 'both')], async (req, res) => {
  try {
    const { title, description, skill_category, price_per_session, duration_minutes } = req.body;

    const updateFields = {};
    if (title) updateFields.title = title;
    if (description) updateFields.description = description;
    if (skill_category) updateFields.skill_category = skill_category;
    if (price_per_session) updateFields.price_per_session = price_per_session;
    if (duration_minutes) updateFields.duration_minutes = duration_minutes;

    // Strict ownership check
    const listing = await Listing.findOneAndUpdate(
      { _id: req.params.id, tutor_id: req.user.id },
      { $set: updateFields },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found or you are not authorized to edit it' });
    }

    res.json(listing);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Listing not found' });
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/listings/:id
// @desc    Delete a listing
// @access  Private (tutor only, owner only)
router.delete('/:id', [authMiddleware, requireRole('tutor', 'both')], async (req, res) => {
  try {
    // Strict ownership check
    const listing = await Listing.findOneAndDelete({ _id: req.params.id, tutor_id: req.user.id });

    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found or you are not authorized to delete it' });
    }

    res.json({ msg: 'Listing removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Listing not found' });
    res.status(500).send('Server Error');
  }
});

module.exports = router;
