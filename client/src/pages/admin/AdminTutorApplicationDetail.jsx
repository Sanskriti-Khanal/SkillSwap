import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, X, ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../utils/api';
import { STATUS_LABELS, STATUS_BADGE } from '../../constants/tutorApplication';

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginBottom: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: '.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div>{value || '—'}</div>
    </div>
  );
}

function DocumentRow({ doc, applicationId, onVerify }) {
  const [loadingUrl, setLoadingUrl] = useState(false);

  async function viewDocument() {
    setLoadingUrl(true);
    try {
      const res = await api.get(`/admin/tutor-applications/${applicationId}/documents/${doc._id}/signed-url`);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setLoadingUrl(false);
    }
  }

  return (
    <div className="uploaded-file">
      <span className="uploaded-file-name">
        {doc.category}: {doc.original_filename}
        {doc.status === 'verified' && <span className="badge badge-green" style={{ marginLeft: 8 }}>Verified</span>}
        {doc.status === 'rejected' && <span className="badge badge-red" style={{ marginLeft: 8 }}>Rejected</span>}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={viewDocument} disabled={loadingUrl}>
          {loadingUrl ? 'Loading…' : 'View'}
        </button>
        {onVerify && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onVerify(doc, true)} aria-label="Verify document">
              <Check className="icon-inline" aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onVerify(doc, false)} aria-label="Reject document">
              <X className="icon-inline" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminTutorApplicationDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reasonDraft, setReasonDraft] = useState('');
  const [showReasonFor, setShowReasonFor] = useState(null); // 'reject' | 'request-more-info' | 'suspend' | 'revoke'
  const [noteDraft, setNoteDraft] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/tutor-applications/${id}`)
      .then((r) => setDetail(r.data))
      .catch((err) => setAlert({ type: 'alert-error', msg: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function runAction(path, body, successMsg) {
    setBusy(true);
    setAlert(null);
    try {
      await api.patch(`/admin/tutor-applications/${id}${path}`, body || {});
      setAlert({ type: 'alert-success', msg: successMsg });
      setShowReasonFor(null);
      setReasonDraft('');
      load();
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function verifyDoc(doc, verified) {
    const endpointCategory = ['id_front', 'id_back', 'selfie'].includes(doc.category)
      ? null // identity verification is separate (verify-identity), not per-document
      : ['certificate', 'transcript'].includes(doc.category) ? 'verify-certificates' : 'verify-portfolio';
    if (!endpointCategory) return;
    await runAction(`/${endpointCategory}`, { documentIds: [doc._id], verified }, `Document ${verified ? 'verified' : 'rejected'}`);
  }

  async function addNote() {
    if (!noteDraft.trim()) return;
    setBusy(true);
    try {
      await api.post(`/admin/tutor-applications/${id}/notes`, { note: noteDraft });
      setNoteDraft('');
      load();
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page"><p>Loading…</p></div>;
  if (!detail || !detail.application) return <div className="page"><p>Application not found.</p></div>;

  const { application, verification, education, experience, skills, documents = [], reviews = [], history = [] } = detail;
  const status = application.status;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/admin/tutor-applications" style={{ fontSize: '.875rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ArrowLeft className="icon-inline" aria-hidden="true" /> All applications
          </Link>
          <h1 style={{ marginTop: 8 }}>{application.personal_info?.full_name || application.user_id?.email}</h1>
          <p style={{ marginTop: 4 }}>
            {application.user_id?.email} · Application ID: {application._id}
          </p>
        </div>
        <span className={`badge ${STATUS_BADGE[status] || 'badge-neutral'}`} style={{ fontSize: '.875rem', padding: '6px 14px' }}>
          {STATUS_LABELS[status] || status}
        </span>
      </div>

      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

      {/* Actions */}
      <Section title="Admin Actions">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['pending_review', 'under_review', 'needs_more_info', 'rejected', 'suspended'].includes(status) && (
            <button className="btn btn-primary" disabled={busy} onClick={() => runAction('/approve', {}, status === 'rejected' || status === 'suspended' ? 'Tutor re-approved' : 'Application approved')}>
              {status === 'rejected' || status === 'suspended' ? 'Approve Again' : 'Approve'}
            </button>
          )}
          {['pending_review', 'under_review', 'needs_more_info'].includes(status) && (
            <button className="btn btn-danger" disabled={busy} onClick={() => setShowReasonFor('reject')}>Reject</button>
          )}
          {['pending_review', 'under_review'].includes(status) && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => setShowReasonFor('request-more-info')}>Request More Info</button>
          )}
          {status === 'approved' && (
            <button className="btn btn-danger" disabled={busy} onClick={() => setShowReasonFor('suspend')}>Suspend</button>
          )}
          {['approved', 'suspended'].includes(status) && (
            <button className="btn btn-danger" disabled={busy} onClick={() => setShowReasonFor('revoke')}>Revoke Tutor Role</button>
          )}
          <button className="btn btn-secondary" disabled={busy} onClick={() => runAction('/feature', { featured: !application.featured }, application.featured ? 'Unfeatured' : 'Marked as featured')}>
            {application.featured ? 'Unfeature' : 'Mark Featured'}
          </button>
        </div>

        {showReasonFor && (
          <div style={{ marginTop: 16 }}>
            <div className="form-group">
              <label>{showReasonFor === 'request-more-info' ? 'Message to applicant' : 'Reason'}</label>
              <textarea value={reasonDraft} onChange={(e) => setReasonDraft(e.target.value)} rows={3} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                disabled={busy || !reasonDraft.trim()}
                onClick={() => {
                  if (showReasonFor === 'reject') runAction('/reject', { reason: reasonDraft }, 'Application rejected');
                  else if (showReasonFor === 'request-more-info') runAction('/request-more-info', { message: reasonDraft }, 'Requested more information');
                  else if (showReasonFor === 'suspend') runAction('/suspend', { reason: reasonDraft }, 'Tutor suspended');
                  else if (showReasonFor === 'revoke') runAction('/revoke', { reason: reasonDraft }, 'Tutor role revoked');
                }}
              >
                Confirm
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowReasonFor(null); setReasonDraft(''); }}>Cancel</button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Personal Information">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Full Name" value={application.personal_info?.full_name} />
          <Field label="Display Name" value={application.personal_info?.display_name} />
          <Field label="Date of Birth" value={application.personal_info?.date_of_birth?.slice?.(0, 10)} />
          <Field label="Gender" value={application.personal_info?.gender} />
          <Field label="Phone" value={application.personal_info?.phone_number} />
          <Field label="Nationality" value={application.personal_info?.nationality} />
          <Field label="Country" value={application.personal_info?.country} />
          <Field label="City" value={application.personal_info?.city} />
          <Field label="Languages" value={(application.personal_info?.languages_spoken || []).join(', ')} />
        </div>
      </Section>

      <Section title="Identity Verification">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Government ID Type" value={verification?.government_id_type} />
          <Field label="Government ID Number" value={verification?.government_id_number} />
          <Field label="Identity Verified" value={verification?.identity_verified ? 'Yes' : 'No'} />
        </div>
        {documents.filter((d) => ['id_front', 'id_back', 'selfie'].includes(d.category)).map((d) => (
          <DocumentRow key={d._id} doc={d} applicationId={id} />
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => runAction('/verify-identity', { verified: true }, 'Identity verified')}>Verify Identity</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => runAction('/verify-identity', { verified: false }, 'Identity marked unverified')}>Unverify</button>
        </div>
      </Section>

      <Section title="Education">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Highest Education" value={education?.highest_education} />
          <Field label="Institution" value={education?.institution_name} />
          <Field label="Field of Study" value={education?.field_of_study} />
          <Field label="Graduation Year" value={education?.graduation_year} />
        </div>
        {documents.filter((d) => ['certificate', 'transcript'].includes(d.category)).map((d) => (
          <DocumentRow key={d._id} doc={d} applicationId={id} onVerify={verifyDoc} />
        ))}
      </Section>

      <Section title="Teaching Profile & Skills">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Headline" value={application.professional_headline} />
          <Field label="Primary Category" value={skills?.primary_category} />
          <Field label="Sub Skills" value={(skills?.sub_skills || []).join(', ')} />
          <Field label="Hourly Rate" value={skills ? `${skills.hourly_rate ?? '—'} ${skills.currency || ''}` : '—'} />
          <Field label="Teaching Mode" value={skills?.teaching_mode} />
          <Field label="Timezone" value={skills?.timezone} />
        </div>
        <Field label="Bio" value={application.bio} />
      </Section>

      <Section title="Professional Experience">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Employment Status" value={experience?.employment_status} />
          <Field label="Current Title" value={experience?.current_title} />
          <Field label="Current Company" value={experience?.current_company} />
          <Field label="Experience Verified" value={experience?.experience_verified ? 'Yes' : 'No'} />
        </div>
        {documents.filter((d) => d.category === 'resume').map((d) => <DocumentRow key={d._id} doc={d} applicationId={id} />)}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => runAction('/verify-experience', { verified: true }, 'Experience verified')}>Verify Experience</button>
        </div>
      </Section>

      <Section title="Teaching Proof / Portfolio">
        <Field label="Demo Video" value={application.teaching_proof?.demo_video_youtube_url} />
        <Field label="Portfolio URL" value={application.teaching_proof?.portfolio_url} />
        <Field label="GitHub Repository" value={application.teaching_proof?.github_repository_url} />
        <Field label="Previous Teaching Experience" value={application.teaching_proof?.previous_teaching_experience} />
        {documents.filter((d) => ['portfolio_sample', 'demo_video'].includes(d.category)).map((d) => (
          <DocumentRow key={d._id} doc={d} applicationId={id} onVerify={verifyDoc} />
        ))}
      </Section>

      <Section title="Verification Questions">
        <Field label="Why do you want to teach?" value={application.verification_answers?.why_teach} />
        <Field label="Teaching Philosophy" value={application.verification_answers?.teaching_philosophy} />
        <Field label="How do you help beginners?" value={application.verification_answers?.how_help_beginners} />
        <Field label="How will you keep students engaged?" value={application.verification_answers?.keep_students_engaged} />
        <Field label="What makes you different?" value={application.verification_answers?.what_makes_different} />
      </Section>

      <Section title="Admin Notes">
        {reviews.length === 0 && <p>No notes yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {reviews.map((r) => (
            <div key={r._id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <div style={{ fontSize: '.8125rem', color: 'var(--muted)' }}>
                {r.reviewer_id?.email} · {r.action} · {new Date(r.createdAt).toLocaleString()}
              </div>
              {r.notes && <div>{r.notes}</div>}
            </div>
          ))}
        </div>
        <div className="form-group">
          <label>Add internal note</label>
          <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} />
        </div>
        <button className="btn btn-secondary btn-sm" disabled={busy || !noteDraft.trim()} onClick={addNote}>Add Note</button>
      </Section>

      <Section title="History">
        {history.map((h) => (
          <div key={h._id} style={{ fontSize: '.875rem', marginBottom: 6 }}>
            <strong>{STATUS_LABELS[h.to_status] || h.to_status}</strong> — {new Date(h.createdAt).toLocaleString()}
            {h.reason && <span> ({h.reason})</span>}
          </div>
        ))}
      </Section>
    </div>
  );
}
