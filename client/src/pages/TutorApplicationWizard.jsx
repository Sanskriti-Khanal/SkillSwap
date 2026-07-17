import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Navigate, Link, useOutletContext } from 'react-router-dom';
import api, { getErrorMessage } from '../utils/api';
import Stepper from '../components/Stepper';
import { WIZARD_STEPS } from '../constants/tutorApplication';

import PersonalInfoStep from './tutor-application/steps/PersonalInfoStep';
import VerificationStep from './tutor-application/steps/VerificationStep';
import EducationStep from './tutor-application/steps/EducationStep';
import TeachingProfileStep from './tutor-application/steps/TeachingProfileStep';
import ExperienceStep from './tutor-application/steps/ExperienceStep';
import TeachingProofStep from './tutor-application/steps/TeachingProofStep';
import VerificationQuestionsStep from './tutor-application/steps/VerificationQuestionsStep';
import AgreementStep from './tutor-application/steps/AgreementStep';
import SubmitSuccess from './tutor-application/SubmitSuccess';

const AUTOSAVE_DELAY = 800;
const EDITABLE_STATUSES = ['draft', 'needs_more_info'];

const emptyState = {
  personalInfo: {},
  verification: {},
  education: {},
  teachingProfile: {},
  experience: {},
  teachingProof: {},
  verificationQuestions: {},
  agreement: {},
};

export default function TutorApplicationWizard() {
  const { step: stepParam } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext();

  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null); // { _id, status, current_step }
  const [documents, setDocuments] = useState([]);
  const [data, setData] = useState(emptyState);
  const [alert, setAlert] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const saveTimers = useRef({});

  useEffect(() => {
    api.get('/tutor-applications/me').then((r) => {
      const d = r.data;
      const app = d.application;
      setMeta(app ? { _id: app._id, status: app.status, current_step: app.current_step } : null);
      setData({
        personalInfo: app?.personal_info || {},
        verification: d.verification || {},
        education: d.education || {},
        teachingProfile: {
          professional_headline: app?.professional_headline || '',
          bio: app?.bio || '',
          availability: app?.availability || [],
          timezone: app?.timezone || '',
          ...(d.skills || {}),
        },
        experience: d.experience || {},
        teachingProof: app?.teaching_proof || {},
        verificationQuestions: app?.verification_answers || {},
        agreement: app?.agreement || {},
      });
      setDocuments(d.documents || []);
      setLoading(false);
    }).catch((err) => {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
      setLoading(false);
    });
  }, []);

  const currentStep = stepParam || meta?.current_step || 'personal-info';

  useEffect(() => {
    if (!loading && !stepParam) {
      navigate(`/tutor/apply/${currentStep}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stepParam]);

  const doSave = useCallback(async (stepKey, payload) => {
    try {
      setSaveStatus('Saving…');
      const res = await api.put(`/tutor-applications/draft/step/${stepKey}`, payload);
      setMeta((prev) => ({ ...(prev || {}), status: res.data.status, current_step: res.data.current_step }));
      setSaveStatus('Saved');
    } catch (err) {
      setSaveStatus('');
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    }
  }, []);

  function scheduleSave(stepKey, payload) {
    clearTimeout(saveTimers.current[stepKey]);
    setSaveStatus('Saving…');
    saveTimers.current[stepKey] = setTimeout(() => doSave(stepKey, payload), AUTOSAVE_DELAY);
  }

  async function flushSave(stepKey, payload) {
    clearTimeout(saveTimers.current[stepKey]);
    await doSave(stepKey, payload);
  }

  function makeStepProps(key, field) {
    return {
      value: data[field],
      onChange: (patch) => {
        setData((prev) => {
          const next = { ...prev, [field]: { ...prev[field], ...patch } };
          scheduleSave(key, next[field]);
          return next;
        });
      },
    };
  }

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === currentStep);

  const completedSteps = WIZARD_STEPS.filter((s) => isStepComplete(s.key, data)).map((s) => s.key);

  async function goToStep(key) {
    const currentField = WIZARD_STEPS[stepIndex]?.key;
    if (currentField) await flushSave(currentField, data[fieldForStep(currentField)]);
    navigate(`/tutor/apply/${key}`);
  }

  async function handleNext() {
    await flushSave(currentStep, data[fieldForStep(currentStep)]);
    const next = WIZARD_STEPS[stepIndex + 1];
    if (next) navigate(`/tutor/apply/${next.key}`);
  }

  function handlePrev() {
    const prev = WIZARD_STEPS[stepIndex - 1];
    if (prev) navigate(`/tutor/apply/${prev.key}`);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setAlert(null);
    try {
      await flushSave(currentStep, data[fieldForStep(currentStep)]);
      await api.post('/tutor-applications/submit', {});
      setSubmitted(true);
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDocUploaded(doc) {
    setDocuments((prev) => [...prev, doc]);
  }
  function handleDocRemoved(docId) {
    setDocuments((prev) => prev.filter((d) => d._id !== docId));
  }

  if (loading) {
    return <div className="page"><p>Loading your application…</p></div>;
  }

  if (submitted) {
    return <SubmitSuccess />;
  }

  if (meta && !EDITABLE_STATUSES.includes(meta.status)) {
    return <Navigate to="/tutor/application/status" replace />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Become a Tutor</h1>
          <p style={{ marginTop: 4 }}>Complete every step to submit your application for review.</p>
        </div>
        <Link to="/tutor/application/status" className="btn btn-secondary btn-sm">Save & exit</Link>
      </div>

      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

      <Stepper steps={WIZARD_STEPS} currentStep={currentStep} completedSteps={completedSteps} onStepClick={goToStep} />

      <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
        {currentStep === 'personal-info' && (
          <PersonalInfoStep {...makeStepProps('personal-info', 'personalInfo')} email={user?.email} documents={documents} onDocUploaded={handleDocUploaded} onDocRemoved={handleDocRemoved} />
        )}
        {currentStep === 'verification' && (
          <VerificationStep {...makeStepProps('verification', 'verification')} documents={documents} onDocUploaded={handleDocUploaded} onDocRemoved={handleDocRemoved} />
        )}
        {currentStep === 'education' && (
          <EducationStep {...makeStepProps('education', 'education')} documents={documents} onDocUploaded={handleDocUploaded} onDocRemoved={handleDocRemoved} />
        )}
        {currentStep === 'teaching-profile' && <TeachingProfileStep {...makeStepProps('teaching-profile', 'teachingProfile')} />}
        {currentStep === 'experience' && (
          <ExperienceStep {...makeStepProps('experience', 'experience')} documents={documents} onDocUploaded={handleDocUploaded} onDocRemoved={handleDocRemoved} />
        )}
        {currentStep === 'teaching-proof' && (
          <TeachingProofStep {...makeStepProps('teaching-proof', 'teachingProof')} documents={documents} onDocUploaded={handleDocUploaded} onDocRemoved={handleDocRemoved} />
        )}
        {currentStep === 'verification-questions' && <VerificationQuestionsStep {...makeStepProps('verification-questions', 'verificationQuestions')} />}
        {currentStep === 'agreement' && <AgreementStep {...makeStepProps('agreement', 'agreement')} />}

        <div className="divider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="autosave-indicator">{saveStatus}</span>
          <div style={{ display: 'flex', gap: 12 }}>
            {stepIndex > 0 && <button type="button" className="btn btn-secondary" onClick={handlePrev}>Previous</button>}
            {stepIndex < WIZARD_STEPS.length - 1 && (
              <button type="button" className="btn btn-primary" onClick={handleNext}>Next</button>
            )}
            {stepIndex === WIZARD_STEPS.length - 1 && (
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fieldForStep(stepKey) {
  return {
    'personal-info': 'personalInfo',
    verification: 'verification',
    education: 'education',
    'teaching-profile': 'teachingProfile',
    experience: 'experience',
    'teaching-proof': 'teachingProof',
    'verification-questions': 'verificationQuestions',
    agreement: 'agreement',
  }[stepKey];
}

function isStepComplete(stepKey, data) {
  switch (stepKey) {
    case 'personal-info': {
      const p = data.personalInfo;
      return Boolean(p.full_name && p.display_name && p.phone_number && p.country && p.city && p.nationality);
    }
    case 'verification':
      return Boolean(data.verification.government_id_type && data.verification.government_id_number);
    case 'education':
      return Boolean(data.education.highest_education);
    case 'teaching-profile':
      return Boolean(data.teachingProfile.professional_headline && (data.teachingProfile.bio || '').length >= 200 && data.teachingProfile.primary_category);
    case 'experience':
      return Boolean(data.experience.employment_status);
    case 'teaching-proof': {
      const tp = data.teachingProof;
      return Boolean(
        tp.demo_video_youtube_url || tp.portfolio_url || tp.testimonials || tp.research_papers_url ||
        tp.articles_url || tp.previous_teaching_experience || tp.projects_url ||
        tp.github_repository_url || tp.case_studies_url
      );
    }
    case 'verification-questions': {
      const va = data.verificationQuestions;
      return Boolean(va.why_teach && va.teaching_philosophy && va.how_help_beginners && va.keep_students_engaged && va.what_makes_different);
    }
    case 'agreement': {
      const a = data.agreement;
      return Boolean(a.info_accurate && a.false_info_understood && a.terms_accepted && a.privacy_policy_accepted && a.signature_name);
    }
    default:
      return false;
  }
}
