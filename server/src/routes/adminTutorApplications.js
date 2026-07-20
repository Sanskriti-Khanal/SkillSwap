const express = require('express');
const { body, validationResult } = require('express-validator');

const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const { isStorageConfigured, getSignedDownloadUrl, getSignedUrlExpirySeconds } = require('../config/storage');
const auditAction = require('../middleware/auditAction');

const TutorApplication = require('../models/TutorApplication');
const TutorVerification = require('../models/TutorVerification');
const TutorDocuments = require('../models/TutorDocuments');
const TutorEducation = require('../models/TutorEducation');
const TutorExperience = require('../models/TutorExperience');
const TutorSkills = require('../models/TutorSkills');
const AdminReview = require('../models/AdminReview');
const ApplicationHistory = require('../models/ApplicationHistory');
const Notification = require('../models/Notification');
const User = require('../models/User');

const router = express.Router();

// Protect all routes in this file
router.use(authMiddleware, requireRole('admin'));

const REVIEWABLE_STATUSES = ['pending_review', 'under_review', 'needs_more_info'];
// Approve is also allowed from 'rejected' (covers re-approving after a revoke, which
// sets status to 'rejected') and 'suspended' (reinstating a suspended tutor) — an admin
// reversing an earlier decision shouldn't require the applicant to resubmit from scratch.
const APPROVABLE_STATUSES = [...REVIEWABLE_STATUSES, 'rejected', 'suspended'];

async function loadFullApplication(id) {
  const application = await TutorApplication.findById(id).populate('user_id', 'email role createdAt');
  if (!application) return null;

  const [verification, education, experience, skills, documents] = await Promise.all([
    application.verification_id ? TutorVerification.findById(application.verification_id) : null,
    application.education_id ? TutorEducation.findById(application.education_id) : null,
    application.experience_id ? TutorExperience.findById(application.experience_id) : null,
    application.skills_id ? TutorSkills.findById(application.skills_id) : null,
    TutorDocuments.find({ application_id: application._id }).select('-storage_key'),
  ]);

  return { application, verification, education, experience, skills, documents };
}

async function transitionStatus(application, toStatus, adminId, reason) {
  const fromStatus = application.status;
  application.status = toStatus;
  if (['approved', 'rejected'].includes(toStatus)) {
    application.reviewed_by = adminId;
    application.reviewed_at = new Date();
  }
  if (toStatus === 'rejected' && reason) application.rejection_reason = reason;
  await application.save();
  await ApplicationHistory.create({
    application_id: application._id, from_status: fromStatus, to_status: toStatus,
    actor_id: adminId, actor_role: 'admin', reason,
  });
}

async function recordReview(applicationId, reviewerId, action, notes, metadata) {
  await AdminReview.create({ application_id: applicationId, reviewer_id: reviewerId, action, notes, metadata });
}

async function notifyApplicant(userId, type, title, message, applicationId) {
  await Notification.create({ user_id: userId, type, title, message, related_application_id: applicationId });
}

// @route   GET /api/admin/tutor-applications
// @desc    List tutor applications with filters + pagination.
// @access  Private/Admin
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    let applications = await TutorApplication.find(filter)
      .populate('user_id', 'email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Skill category filter requires a join to TutorSkills — applied post-fetch on this page
    // for simplicity, matching the pagination approach used by GET /api/admin/users.
    if (req.query.category) {
      const skillIds = applications.map((a) => a.skills_id).filter(Boolean);
      const skills = await TutorSkills.find({ _id: { $in: skillIds }, primary_category: req.query.category });
      const allowedSkillIds = new Set(skills.map((s) => s._id.toString()));
      applications = applications.filter((a) => a.skills_id && allowedSkillIds.has(a.skills_id.toString()));
    }

    const total = await TutorApplication.countDocuments(filter);

    res.json({ applications, currentPage: page, totalPages: Math.ceil(total / limit), total });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/tutor-applications/:id
// @desc    Full application detail, including identity verification data.
// @access  Private/Admin
router.get('/:id', auditAction('admin.tutor_application_viewed', 'TutorApplication'), async (req, res) => {
  try {
    const full = await loadFullApplication(req.params.id);
    if (!full) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Application not found' });
    }

    const reviews = await AdminReview.find({ application_id: req.params.id })
      .populate('reviewer_id', 'email')
      .sort({ createdAt: -1 });
    const history = await ApplicationHistory.find({ application_id: req.params.id }).sort({ createdAt: 1 });

    res.json({ ...full, reviews, history });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Application not found' });
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/admin/tutor-applications/:id/documents/:documentId/signed-url
// @desc    Short-lived signed GET URL for a private document. The only way documents
//          are ever read back — no public URL is ever returned to a non-admin.
// @access  Private/Admin
router.get('/:id/documents/:documentId/signed-url', auditAction('admin.document_viewed', 'TutorApplication'), async (req, res) => {
  if (!isStorageConfigured()) {
    res.locals.audit.skip = true; // storage not configured — not a real audit-worthy attempt
    return res.status(503).json({ msg: 'File storage is not configured yet' });
  }
  try {
    const doc = await TutorDocuments.findOne({ _id: req.params.documentId, application_id: req.params.id });
    if (!doc) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Document not found' });
    }

    const url = getSignedDownloadUrl(doc.storage_key, doc.format, doc.resource_type, getSignedUrlExpirySeconds());

    res.locals.audit.metadata = { documentId: doc._id, category: doc.category };
    res.json({ url, expiresIn: getSignedUrlExpirySeconds() });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Document not found' });
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/tutor-applications/:id/approve
// @desc    Approve the application and flip the user's role to tutor.
// @access  Private/Admin
router.patch('/:id/approve', auditAction('admin.tutor_application_approved', 'TutorApplication'), async (req, res) => {
  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Application not found' });
    }
    if (!APPROVABLE_STATUSES.includes(application.status)) {
      res.locals.audit.status = 'failure';
      return res.status(409).json({ msg: `Cannot approve an application with status ${application.status}` });
    }

    const user = await User.findById(application.user_id);
    if (!user) return res.status(404).json({ msg: 'Applicant user not found' });

    const previousRole = user.role;
    user.role = user.role === 'learner' ? 'tutor' : 'both';
    await user.save();

    await transitionStatus(application, 'approved', req.user.id, req.body.notes);
    await recordReview(application._id, req.user.id, 'approve', req.body.notes);
    await notifyApplicant(
      application.user_id, 'application_approved', 'Application approved',
      'Congratulations! Your tutor application has been approved.', application._id
    );
    await notifyApplicant(
      application.user_id, 'tutor_account_activated', 'Tutor account activated',
      'Your tutor dashboard is now available.', application._id
    );

    res.locals.audit.metadata = { targetUserId: user._id, previousRole, newRole: user.role };
    res.json({ msg: 'Application approved', status: application.status, userRole: user.role });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Application not found' });
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/tutor-applications/:id/reject
// @desc    Reject the application with a reason.
// @access  Private/Admin
router.patch('/:id/reject', auditAction('admin.tutor_application_rejected', 'TutorApplication'), [
  body('reason', 'A rejection reason is required').not().isEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Application not found' });
    }
    if (!REVIEWABLE_STATUSES.includes(application.status)) {
      res.locals.audit.status = 'failure';
      return res.status(409).json({ msg: `Cannot reject an application with status ${application.status}` });
    }

    await transitionStatus(application, 'rejected', req.user.id, req.body.reason);
    await recordReview(application._id, req.user.id, 'reject', req.body.reason);
    await notifyApplicant(
      application.user_id, 'application_rejected', 'Application rejected',
      `Your tutor application was rejected: ${req.body.reason}`, application._id
    );

    res.locals.audit.metadata = { reason: req.body.reason };
    res.json({ msg: 'Application rejected', status: application.status });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Application not found' });
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/tutor-applications/:id/request-more-info
// @desc    Reopen the application for editing with a message to the applicant.
// @access  Private/Admin
router.patch('/:id/request-more-info', auditAction('admin.tutor_application_more_info_requested', 'TutorApplication'), [
  body('message', 'A message explaining what is needed is required').not().isEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Application not found' });
    }
    if (!['pending_review', 'under_review'].includes(application.status)) {
      res.locals.audit.status = 'failure';
      return res.status(409).json({ msg: `Cannot request more info on an application with status ${application.status}` });
    }

    await transitionStatus(application, 'needs_more_info', req.user.id, req.body.message);
    await recordReview(application._id, req.user.id, 'request_more_info', req.body.message);
    await notifyApplicant(
      application.user_id, 'more_documents_requested', 'More information needed',
      req.body.message, application._id
    );

    res.json({ msg: 'Requested more information', status: application.status });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Application not found' });
    res.status(500).send('Server Error');
  }
});

// Verification sub-resource checks — verify-identity, verify-certificates,
// verify-portfolio, verify-experience all follow the same shape: set a verified
// flag on the relevant sub-document, log an AdminReview + audit entry.

// @route   PATCH /api/admin/tutor-applications/:id/verify-identity
router.patch('/:id/verify-identity', auditAction('admin.tutor_identity_verified', 'TutorApplication'), [
  body('verified').isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application || !application.verification_id) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Verification record not found' });
    }

    const verification = await TutorVerification.findById(application.verification_id);
    verification.identity_verified = req.body.verified;
    verification.identity_verified_by = req.user.id;
    verification.identity_verified_at = new Date();
    await verification.save();

    await recordReview(application._id, req.user.id, 'verify_identity', req.body.notes, { verified: req.body.verified });
    res.locals.audit.metadata = { verified: req.body.verified };
    res.json({ msg: 'Identity verification updated', identity_verified: verification.identity_verified });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/tutor-applications/:id/verify-certificates
router.patch('/:id/verify-certificates', auditAction('admin.tutor_certificates_verified', 'TutorApplication'), [
  body('documentIds').isArray({ min: 1 }),
  body('verified').isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
  try {
    const status = req.body.verified ? 'verified' : 'rejected';
    await TutorDocuments.updateMany(
      { _id: { $in: req.body.documentIds }, application_id: req.params.id },
      { $set: { status, rejection_reason: req.body.verified ? undefined : req.body.reason } }
    );
    await recordReview(req.params.id, req.user.id, 'verify_certificates', req.body.notes, { documentIds: req.body.documentIds, verified: req.body.verified });
    res.locals.audit.metadata = { documentIds: req.body.documentIds, verified: req.body.verified };
    res.json({ msg: 'Certificate verification updated' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/tutor-applications/:id/verify-portfolio
router.patch('/:id/verify-portfolio', auditAction('admin.tutor_portfolio_verified', 'TutorApplication'), [
  body('documentIds').isArray({ min: 1 }),
  body('verified').isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
  try {
    const status = req.body.verified ? 'verified' : 'rejected';
    await TutorDocuments.updateMany(
      { _id: { $in: req.body.documentIds }, application_id: req.params.id },
      { $set: { status, rejection_reason: req.body.verified ? undefined : req.body.reason } }
    );
    await recordReview(req.params.id, req.user.id, 'verify_portfolio', req.body.notes, { documentIds: req.body.documentIds, verified: req.body.verified });
    res.locals.audit.metadata = { documentIds: req.body.documentIds, verified: req.body.verified };
    res.json({ msg: 'Portfolio verification updated' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/tutor-applications/:id/verify-experience
router.patch('/:id/verify-experience', auditAction('admin.tutor_experience_verified', 'TutorApplication'), [
  body('verified').isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application || !application.experience_id) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Experience record not found' });
    }

    const experience = await TutorExperience.findById(application.experience_id);
    experience.experience_verified = req.body.verified;
    await experience.save();

    await recordReview(application._id, req.user.id, 'verify_experience', req.body.notes, { verified: req.body.verified });
    res.locals.audit.metadata = { verified: req.body.verified };
    res.json({ msg: 'Experience verification updated', experience_verified: experience.experience_verified });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/tutor-applications/:id/feature
// @desc    Toggle featured-tutor status.
// @access  Private/Admin
router.patch('/:id/feature', auditAction('admin.tutor_featured_toggled', 'TutorApplication'), [
  body('featured').isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Application not found' });
    }

    application.featured = req.body.featured;
    await application.save();

    await recordReview(application._id, req.user.id, req.body.featured ? 'feature' : 'unfeature', req.body.notes);
    res.locals.audit.metadata = { featured: req.body.featured };
    res.json({ msg: 'Featured status updated', featured: application.featured });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/tutor-applications/:id/suspend
// @desc    Reversible hold — demotes the user's role back down.
// @access  Private/Admin
router.patch('/:id/suspend', auditAction('admin.tutor_suspended', 'TutorApplication'), [
  body('reason', 'A suspension reason is required').not().isEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Application not found' });
    }
    if (application.status !== 'approved') {
      res.locals.audit.status = 'failure';
      return res.status(409).json({ msg: `Cannot suspend an application with status ${application.status}` });
    }

    const user = await User.findById(application.user_id);
    if (user) {
      user.role = user.role === 'both' ? 'learner' : user.role === 'tutor' ? 'learner' : user.role;
      await user.save();
    }

    await transitionStatus(application, 'suspended', req.user.id, req.body.reason);
    await recordReview(application._id, req.user.id, 'suspend', req.body.reason);
    res.locals.audit.metadata = { reason: req.body.reason };
    res.json({ msg: 'Tutor suspended', status: application.status });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/admin/tutor-applications/:id/revoke
// @desc    Terminal revocation of tutor status.
// @access  Private/Admin
router.patch('/:id/revoke', auditAction('admin.tutor_revoked', 'TutorApplication'), [
  body('reason', 'A revocation reason is required').not().isEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application) {
      res.locals.audit.status = 'failure';
      return res.status(404).json({ msg: 'Application not found' });
    }
    if (!['approved', 'suspended'].includes(application.status)) {
      res.locals.audit.status = 'failure';
      return res.status(409).json({ msg: `Cannot revoke an application with status ${application.status}` });
    }

    const user = await User.findById(application.user_id);
    if (user) {
      user.role = user.role === 'both' ? 'learner' : user.role === 'tutor' ? 'learner' : user.role;
      await user.save();
    }

    await transitionStatus(application, 'rejected', req.user.id, req.body.reason);
    await recordReview(application._id, req.user.id, 'revoke', req.body.reason);
    await notifyApplicant(
      application.user_id, 'application_rejected', 'Tutor status revoked',
      `Your tutor status has been revoked: ${req.body.reason}`, application._id
    );
    res.locals.audit.metadata = { reason: req.body.reason };
    res.json({ msg: 'Tutor status revoked', status: application.status });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/admin/tutor-applications/:id/notes
// @desc    Add an internal admin note (does not notify the applicant).
// @access  Private/Admin
router.post('/:id/notes', [
  body('note', 'Note text is required').not().isEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ msg: 'Application not found' });

    await recordReview(application._id, req.user.id, 'note', req.body.note);
    res.status(201).json({ msg: 'Note added' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/admin/tutor-applications/:id/notify
// @desc    Manually send an in-app notification to the applicant.
// @access  Private/Admin
router.post('/:id/notify', [
  body('message', 'A message is required').not().isEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }
  try {
    const application = await TutorApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ msg: 'Application not found' });

    await notifyApplicant(application.user_id, 'admin_note', 'Message from SkillSwap', req.body.message, application._id);
    await recordReview(application._id, req.user.id, 'notify', req.body.message);
    res.status(201).json({ msg: 'Notification sent' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
