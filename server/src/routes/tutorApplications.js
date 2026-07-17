const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

const authMiddleware = require('../middleware/auth');
const { applicationSubmitRateLimiter } = require('../middleware/rateLimiter');
const { isStorageConfigured, createUploadSignature, getResourceMetadata, deleteResource, fetchFilePrefixBytes } = require('../config/storage');
const { validateFileSignature } = require('../services/fileSignatures');
const { logEvent } = require('../services/logger');

const TutorApplication = require('../models/TutorApplication');
const TutorVerification = require('../models/TutorVerification');
const TutorDocuments = require('../models/TutorDocuments');
const TutorEducation = require('../models/TutorEducation');
const TutorExperience = require('../models/TutorExperience');
const TutorSkills = require('../models/TutorSkills');
const ApplicationHistory = require('../models/ApplicationHistory');
const Notification = require('../models/Notification');

const router = express.Router();
router.use(authMiddleware);

const ACTIVE_STATUSES = ['draft', 'submitted', 'pending_review', 'under_review', 'needs_more_info'];
const LOCKED_STATUSES = ['submitted', 'pending_review', 'under_review', 'approved', 'rejected', 'suspended'];

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
// Maps Cloudinary's self-reported `format` (e.g. "jpg") back to the MIME type we
// validate against — used so magic-byte validation checks what Cloudinary detected,
// not an unverified client-supplied field.
const FORMAT_TO_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
const DOCUMENT_CATEGORIES = [
  'profile_photo', 'cover_photo', 'id_front', 'id_back', 'selfie',
  'certificate', 'transcript', 'resume', 'portfolio_sample', 'demo_video', 'other',
];

function pick(source = {}, keys) {
  const out = {};
  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(source, k)) out[k] = source[k];
  });
  return out;
}

function isEditable(application) {
  if (!application) return true;
  if (application.status === 'needs_more_info') return true;
  return !LOCKED_STATUSES.includes(application.status);
}

async function findActiveApplication(userId) {
  return TutorApplication.findOne({ user_id: userId, status: { $in: ACTIVE_STATUSES } });
}

async function getOrCreateDraft(userId) {
  let application = await findActiveApplication(userId);
  if (!application) {
    application = new TutorApplication({ user_id: userId, status: 'draft' });
    await application.save();
  }
  return application;
}

// @route   GET /api/tutor-applications/me
// @desc    Get the caller's current (active, most recent) tutor application, or their
//          most recently reviewed one if none is active — used to resume/track.
// @access  Private
router.get('/me', async (req, res) => {
  try {
    let application = await findActiveApplication(req.user.id);
    if (!application) {
      application = await TutorApplication.findOne({ user_id: req.user.id }).sort({ createdAt: -1 });
    }
    if (!application) {
      return res.json({ application: null });
    }

    const [verification, education, experience, skills, documents] = await Promise.all([
      application.verification_id ? TutorVerification.findById(application.verification_id) : null,
      application.education_id ? TutorEducation.findById(application.education_id) : null,
      application.experience_id ? TutorExperience.findById(application.experience_id) : null,
      application.skills_id ? TutorSkills.findById(application.skills_id) : null,
      TutorDocuments.find({ application_id: application._id }).select('-storage_key'),
    ]);

    res.json({ application, verification, education, experience, skills, documents });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/tutor-applications/draft/step/:stepKey
// @desc    Autosave one wizard step. Creates the draft application on first call.
// @access  Private
router.put('/draft/step/:stepKey', async (req, res) => {
  try {
    const application = await getOrCreateDraft(req.user.id);
    if (!isEditable(application)) {
      return res.status(409).json({ msg: `Application cannot be edited while status is ${application.status}` });
    }

    const { stepKey } = req.params;
    const body = req.body || {};

    switch (stepKey) {
      case 'personal-info': {
        application.personal_info = {
          ...application.personal_info?.toObject?.() ?? application.personal_info,
          ...pick(body, [
            'full_name', 'display_name', 'date_of_birth', 'gender', 'phone_number',
            'country', 'province_state', 'district', 'city', 'full_address',
            'nationality', 'languages_spoken',
          ]),
        };
        application.current_step = 'personal-info';
        await application.save();
        break;
      }
      case 'verification': {
        const fields = pick(body, ['government_id_type', 'government_id_number', 'live_face_verification_requested']);
        let verification = application.verification_id
          ? await TutorVerification.findById(application.verification_id)
          : null;
        if (!verification) {
          verification = new TutorVerification({ application_id: application._id, user_id: req.user.id, ...fields });
        } else {
          Object.assign(verification, fields);
        }
        await verification.save();
        application.verification_id = verification._id;
        application.current_step = 'verification';
        await application.save();
        break;
      }
      case 'education': {
        const fields = pick(body, [
          'highest_education', 'institution_name', 'field_of_study', 'graduation_year',
          'currently_enrolled', 'certifications',
        ]);
        let education = application.education_id
          ? await TutorEducation.findById(application.education_id)
          : null;
        if (!education) {
          education = new TutorEducation({ application_id: application._id, ...fields });
        } else {
          Object.assign(education, fields);
        }
        await education.save();
        application.education_id = education._id;
        application.current_step = 'education';
        await application.save();
        break;
      }
      case 'teaching-profile': {
        Object.assign(application, pick(body, ['professional_headline', 'bio']));
        if (body.availability !== undefined) application.availability = body.availability;
        if (body.timezone !== undefined) application.timezone = body.timezone;

        const skillFields = pick(body, [
          'primary_category', 'sub_skills', 'teaching_experience_years', 'teaching_level',
          'teaching_languages', 'teaching_mode', 'teaching_location', 'hourly_rate',
          'currency', 'max_students', 'timezone',
        ]);
        let skills = application.skills_id ? await TutorSkills.findById(application.skills_id) : null;
        if (!skills) {
          skills = new TutorSkills({ application_id: application._id, ...skillFields });
        } else {
          Object.assign(skills, skillFields);
        }
        await skills.save();
        application.skills_id = skills._id;
        application.current_step = 'teaching-profile';
        await application.save();
        break;
      }
      case 'experience': {
        const fields = pick(body, [
          'employment_status', 'current_company', 'current_title',
          'years_of_teaching_experience', 'years_of_professional_experience', 'portfolio_links',
        ]);
        let experience = application.experience_id
          ? await TutorExperience.findById(application.experience_id)
          : null;
        if (!experience) {
          experience = new TutorExperience({ application_id: application._id, ...fields });
        } else {
          Object.assign(experience, fields);
        }
        await experience.save();
        application.experience_id = experience._id;
        application.current_step = 'experience';
        await application.save();
        break;
      }
      case 'teaching-proof': {
        application.teaching_proof = {
          ...application.teaching_proof?.toObject?.() ?? application.teaching_proof,
          ...pick(body, [
            'demo_video_youtube_url', 'portfolio_url', 'testimonials', 'research_papers_url',
            'articles_url', 'previous_teaching_experience', 'projects_url',
            'github_repository_url', 'case_studies_url',
          ]),
        };
        application.current_step = 'teaching-proof';
        await application.save();
        break;
      }
      case 'verification-questions': {
        application.verification_answers = {
          ...application.verification_answers?.toObject?.() ?? application.verification_answers,
          ...pick(body, ['why_teach', 'teaching_philosophy', 'how_help_beginners', 'keep_students_engaged', 'what_makes_different']),
        };
        application.current_step = 'verification-questions';
        await application.save();
        break;
      }
      case 'agreement': {
        application.agreement = {
          ...application.agreement?.toObject?.() ?? application.agreement,
          ...pick(body, [
            'info_accurate', 'false_info_understood', 'terms_accepted',
            'privacy_policy_accepted', 'signature_name', 'signature_date',
          ]),
        };
        application.current_step = 'agreement';
        await application.save();
        break;
      }
      default:
        return res.status(400).json({ msg: `Unknown step: ${stepKey}` });
    }

    res.json({ msg: 'Saved', status: application.status, current_step: application.current_step });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/tutor-applications/documents/presign
// @desc    Get a signed Cloudinary upload signature for a document upload (client
//          uploads directly to Cloudinary using this signature).
// @access  Private
router.post('/documents/presign', applicationSubmitRateLimiter, [
  body('category').isIn(DOCUMENT_CATEGORIES),
  body('mime_type').isIn(ALLOWED_MIME_TYPES),
  body('size_bytes').isInt({ min: 1, max: MAX_FILE_SIZE_BYTES }),
  body('filename').not().isEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  if (!isStorageConfigured()) {
    return res.status(503).json({ msg: 'File storage is not configured yet' });
  }

  try {
    const application = await getOrCreateDraft(req.user.id);
    if (!isEditable(application)) {
      return res.status(409).json({ msg: `Application cannot be edited while status is ${application.status}` });
    }

    const { category } = req.body;
    const publicId = `tutor-applications/${application._id}/${category}/${crypto.randomUUID()}`;
    const signaturePayload = createUploadSignature({ publicId });

    res.json(signaturePayload);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/tutor-applications/documents/confirm
// @desc    Confirm a completed Cloudinary upload and create the TutorDocuments row.
// @access  Private
router.post('/documents/confirm', [
  body('storage_key').not().isEmpty(),
  body('category').isIn(DOCUMENT_CATEGORIES),
  body('original_filename').not().isEmpty(),
  body('resource_type').isIn(['image', 'video', 'raw']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { return res.status(400).json({ errors: errors.array() }); }

  if (!isStorageConfigured()) {
    return res.status(503).json({ msg: 'File storage is not configured yet' });
  }

  try {
    const application = await getOrCreateDraft(req.user.id);
    if (!isEditable(application)) {
      return res.status(409).json({ msg: `Application cannot be edited while status is ${application.status}` });
    }

    const { storage_key, category, original_filename, resource_type } = req.body;
    // SECURITY: storage_key (Cloudinary public_id) must belong to this application —
    // prevents confirming (and thereby claiming) an asset from another application/user.
    if (!storage_key.startsWith(`tutor-applications/${application._id}/`)) {
      return res.status(403).json({ msg: 'Invalid storage key for this application' });
    }

    // Re-validate actual uploaded asset against what was declared at presign time —
    // defends against a client uploading something different than it signed for.
    const resource = await getResourceMetadata(storage_key, resource_type);
    if (resource.bytes > MAX_FILE_SIZE_BYTES) {
      await deleteResource(storage_key, resource_type);
      logEvent(req.user.id, 'tutor_application.upload_rejected', {
        ipAddress: req.ip, applicationId: application._id, category, reason: 'file_too_large',
      });
      return res.status(400).json({ msg: 'Uploaded file failed validation and was removed' });
    }

    // SECURITY: magic-byte validation — verify the file's actual binary content matches
    // its detected type, independent of extension/MIME-type claims. Defends against a
    // disguised/renamed file (e.g. an executable saved as .pdf) slipping through checks
    // that only look at metadata. See services/fileSignatures.js.
    const expectedMime = FORMAT_TO_MIME[resource.format];
    const prefixBytes = await fetchFilePrefixBytes(storage_key, resource.format, resource_type);
    const signatureCheck = expectedMime ? validateFileSignature(prefixBytes, expectedMime) : { valid: false, reason: `Unrecognized format "${resource.format}"` };
    if (!signatureCheck.valid) {
      await deleteResource(storage_key, resource_type);
      logEvent(req.user.id, 'tutor_application.upload_rejected', {
        ipAddress: req.ip, applicationId: application._id, category, reason: signatureCheck.reason,
      });
      return res.status(400).json({ msg: 'Invalid file format. The uploaded file content does not match the selected file type.' });
    }

    const doc = await TutorDocuments.create({
      application_id: application._id,
      user_id: req.user.id,
      category,
      storage_key,
      resource_type,
      format: resource.format,
      original_filename,
      size_bytes: resource.bytes,
    });

    logEvent(req.user.id, 'tutor_application.document_uploaded', { ipAddress: req.ip, applicationId: application._id, category });
    res.status(201).json({ _id: doc._id, category: doc.category, original_filename: doc.original_filename, status: doc.status });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/tutor-applications/documents/:documentId
// @desc    Remove an uploaded document while the application is still editable.
// @access  Private
router.delete('/documents/:documentId', async (req, res) => {
  try {
    const doc = await TutorDocuments.findById(req.params.documentId);
    if (!doc || doc.user_id.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Document not found' });
    }

    const application = await TutorApplication.findById(doc.application_id);
    if (!isEditable(application)) {
      return res.status(409).json({ msg: `Application cannot be edited while status is ${application.status}` });
    }

    if (isStorageConfigured()) {
      await deleteResource(doc.storage_key, doc.resource_type).catch(() => {});
    }
    await doc.deleteOne();
    res.json({ msg: 'Document removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Document not found' });
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/tutor-applications/submit
// @desc    Final validation gate + submit for review.
// @access  Private
router.post('/submit', applicationSubmitRateLimiter, async (req, res) => {
  try {
    const application = await findActiveApplication(req.user.id);
    if (!application) {
      return res.status(404).json({ msg: 'No draft application found' });
    }
    if (!isEditable(application)) {
      return res.status(409).json({ msg: `Application cannot be edited while status is ${application.status}` });
    }

    const [verification, education, skills, documents] = await Promise.all([
      application.verification_id ? TutorVerification.findById(application.verification_id) : null,
      application.education_id ? TutorEducation.findById(application.education_id) : null,
      application.skills_id ? TutorSkills.findById(application.skills_id) : null,
      TutorDocuments.find({ application_id: application._id }),
    ]);

    const errors = [];
    const p = application.personal_info || {};
    if (!p.full_name) errors.push('Full name is required');
    if (!p.display_name) errors.push('Display name is required');
    if (!p.phone_number || !/^\+?[0-9\s\-()]{7,20}$/.test(p.phone_number)) errors.push('A valid phone number is required');
    if (!p.country) errors.push('Country is required');
    if (!p.city) errors.push('City is required');
    if (!p.nationality) errors.push('Nationality is required');
    if (!p.languages_spoken || p.languages_spoken.length === 0) errors.push('At least one spoken language is required');

    if (!verification || !verification.government_id_type || !verification.government_id_number) {
      errors.push('Government ID information is required');
    }
    const identityDocs = documents.filter((d) => ['id_front', 'id_back', 'selfie'].includes(d.category));
    if (identityDocs.length === 0) errors.push('At least one identity document is required');

    if (!education || !education.highest_education) errors.push('Education information is required');
    const educationDocs = documents.filter((d) => ['certificate', 'transcript'].includes(d.category));
    if (educationDocs.length === 0) errors.push('At least one education document (certificate or transcript) is required');

    if (!application.professional_headline) errors.push('Professional headline is required');
    if (!application.bio || application.bio.length < 200) errors.push('Bio must be at least 200 characters');
    if (!skills || !skills.primary_category) errors.push('Primary skill category is required');
    if (!skills || !skills.sub_skills || skills.sub_skills.length === 0) errors.push('At least one skill is required');

    const tp = application.teaching_proof || {};
    const hasTeachingProof = Boolean(
      tp.demo_video_youtube_url || tp.portfolio_url || tp.testimonials || tp.research_papers_url ||
      tp.articles_url || tp.previous_teaching_experience || tp.projects_url ||
      tp.github_repository_url || tp.case_studies_url || (tp.document_ids && tp.document_ids.length > 0)
    );
    if (!hasTeachingProof) errors.push('At least one form of teaching proof is required');

    const va = application.verification_answers || {};
    if (!va.why_teach) errors.push('Please answer: why do you want to teach?');
    if (!va.teaching_philosophy || va.teaching_philosophy.length < 150) errors.push('Teaching philosophy must be at least 150 characters');
    if (!va.how_help_beginners) errors.push('Please answer: how do you help beginners?');
    if (!va.keep_students_engaged) errors.push('Please answer: how will you keep students engaged?');
    if (!va.what_makes_different) errors.push('Please answer: what makes you different from other tutors?');

    const a = application.agreement || {};
    if (!a.info_accurate || !a.false_info_understood || !a.terms_accepted || !a.privacy_policy_accepted) {
      errors.push('All agreement checkboxes must be accepted');
    }
    if (!a.signature_name) errors.push('A digital signature (typed full name) is required');

    if (errors.length > 0) {
      return res.status(400).json({ errors: errors.map((msg) => ({ msg })) });
    }

    const fromStatus = application.status;
    application.status = 'pending_review';
    application.submitted_at = new Date();
    application.agreement.signature_date = new Date();
    await application.save();

    await ApplicationHistory.create({
      application_id: application._id, from_status: fromStatus, to_status: 'pending_review',
      actor_id: req.user.id, actor_role: 'applicant', reason: 'Application submitted',
    });
    await Notification.create({
      user_id: req.user.id, type: 'application_submitted',
      title: 'Application submitted', message: 'Your tutor application has been submitted and is pending review.',
      related_application_id: application._id,
    });
    logEvent(req.user.id, 'tutor_application.submitted', { ipAddress: req.ip, applicationId: application._id });

    res.json({ msg: 'Application submitted', status: application.status });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/tutor-applications/status
// @desc    Current status + history timeline.
// @access  Private
router.get('/status', async (req, res) => {
  try {
    const application = await TutorApplication.findOne({ user_id: req.user.id }).sort({ createdAt: -1 });
    if (!application) return res.json({ application: null, history: [] });

    const history = await ApplicationHistory.find({ application_id: application._id }).sort({ createdAt: 1 });
    res.json({
      application: {
        _id: application._id,
        status: application.status,
        rejection_reason: application.rejection_reason,
        submitted_at: application.submitted_at,
        reviewed_at: application.reviewed_at,
      },
      history,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
