import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import api, { getErrorMessage } from '../utils/api';
import { STATUS_LABELS, STATUS_BADGE } from '../constants/tutorApplication';

export default function ApplicationStatus() {
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [history, setHistory] = useState([]);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    api.get('/tutor-applications/status')
      .then((r) => {
        setApplication(r.data.application);
        setHistory(r.data.history || []);
      })
      .catch((err) => setAlert({ type: 'alert-error', msg: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><p>Loading…</p></div>;

  if (!application) {
    return (
      <div className="page-narrow">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="icon-badge icon-badge-orange icon-badge-lg" style={{ margin: '0 auto 16px' }}><GraduationCap aria-hidden="true" /></div>
          <h2 style={{ marginBottom: 12 }}>No application yet</h2>
          <p style={{ marginBottom: 24 }}>You haven't started a tutor application.</p>
          <Link to="/tutor/apply" className="btn btn-primary">Become a Tutor</Link>
        </div>
      </div>
    );
  }

  const canEdit = ['draft', 'needs_more_info'].includes(application.status);

  return (
    <div className="page-narrow">
      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

      <div className="card">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: '1.5rem' }}>Application Status</h1>
          <span className={`badge ${STATUS_BADGE[application.status] || 'badge-neutral'}`}>
            {STATUS_LABELS[application.status] || application.status}
          </span>
        </div>

        {application.status === 'rejected' && application.rejection_reason && (
          <div className="alert alert-error">Reason: {application.rejection_reason}</div>
        )}
        {application.status === 'needs_more_info' && (
          <div className="alert alert-error">
            The admin team requested more information. Please review and resubmit your application.
          </div>
        )}

        {application.submitted_at && (
          <p style={{ fontSize: '.875rem', marginBottom: 8 }}>
            Submitted: {new Date(application.submitted_at).toLocaleString()}
          </p>
        )}
        {application.reviewed_at && (
          <p style={{ fontSize: '.875rem', marginBottom: 8 }}>
            Reviewed: {new Date(application.reviewed_at).toLocaleString()}
          </p>
        )}

        {canEdit && (
          <div style={{ marginTop: 16 }}>
            <Link to="/tutor/apply" className="btn btn-primary">
              {application.status === 'draft' ? 'Continue Application' : 'Edit & Resubmit'}
            </Link>
          </div>
        )}

        <div className="divider" />

        <h3 style={{ marginBottom: 16 }}>Timeline</h3>
        {history.length === 0 && <p>No status changes yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((h) => (
            <div key={h._id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.1rem' }}>•</span>
              <div>
                <strong style={{ color: 'var(--dark)' }}>{STATUS_LABELS[h.to_status] || h.to_status}</strong>
                {h.reason && <p style={{ fontSize: '.875rem' }}>{h.reason}</p>}
                <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{new Date(h.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
