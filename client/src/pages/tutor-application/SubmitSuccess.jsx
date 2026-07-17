import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export default function SubmitSuccess() {
  return (
    <div className="page-narrow">
      <div className="card fade-up" style={{ textAlign: 'center', padding: 48 }}>
        <div className="icon-badge icon-badge-green icon-badge-lg" style={{ margin: '0 auto 16px' }}>
          <CheckCircle2 aria-hidden="true" />
        </div>
        <h1 style={{ marginBottom: 12 }}>Application Submitted</h1>
        <p style={{ marginBottom: 24 }}>
          Thanks for applying to become a tutor. Our team will review your application and get back to you soon.
          You'll be notified as your application moves through review.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link to="/tutor/application/status" className="btn btn-primary">Track Application Status</Link>
          <Link to="/dashboard" className="btn btn-secondary">Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
