import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import api from '../utils/api';

// Khalti KPG v2 has a single return_url for every outcome (paid, pending, expired,
// cancelled) — it is NOT a "success-only" redirect. The query params on that redirect
// are never trusted for the actual decision: we always confirm with a server-side
// lookup (POST /payments/verify) and only render success once the server says 'paid'.
export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('booking_id');

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'paid' | 'error'
  const [error, setError] = useState('');
  const [meetingLink, setMeetingLink] = useState(null);

  useEffect(() => {
    if (!bookingId) {
      navigate('/bookings', { replace: true });
      return;
    }

    const verify = async () => {
      try {
        const res = await api.post('/payments/verify', { booking_id: bookingId });
        if (res.data.status === 'paid') {
          setMeetingLink(res.data.meeting_link || null);
          setStatus('paid');
        } else {
          // Not completed — hand off to the cancel/failure landing page with the
          // server-verified reason (informational only, no trust placed on it here).
          navigate(`/payment-cancel?booking_id=${bookingId}&reason=${res.data.status}`, { replace: true });
        }
      } catch (err) {
        setStatus('error');
        setError(err.response?.data?.msg || 'Could not verify payment status.');
      }
    };
    verify();
  }, [bookingId, navigate]);

  if (status === 'verifying') {
    return (
      <div className="auth-page fade-up">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>Confirming your payment…</h2>
          <p>Please wait while we verify your payment with Khalti.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="auth-page fade-up">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>Couldn't confirm payment</h2>
          <p style={{ marginBottom: 32 }}>{error}</p>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => navigate('/bookings')}>Back to bookings</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page fade-up">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <CheckCircle2 width={32} height={32} strokeWidth={1.75} color="var(--success)" aria-hidden="true" />
        </div>
        <h2 style={{ marginBottom: 8 }}>Payment successful!</h2>
        <p style={{ marginBottom: meetingLink ? 16 : 32 }}>Your booking is confirmed. You'll find the details in My Bookings.</p>
        {meetingLink && (
          <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg" style={{ width: '100%', display: 'block', marginBottom: 16 }}>Join video call</a>
        )}
        <button className={`btn btn-lg ${meetingLink ? 'btn-secondary' : 'btn-primary'}`} style={{ width: '100%' }} onClick={() => navigate('/bookings')}>View my bookings</button>
      </div>
    </div>
  );
}
