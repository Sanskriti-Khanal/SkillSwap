import { useSearchParams, useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const REASON_COPY = {
  failed: 'The payment did not complete.',
  pending: 'Your payment is still pending confirmation from Khalti.',
};

// Reached only after PaymentSuccess has server-verified that the payment did NOT
// settle (status !== 'paid') — this page never makes that determination itself.
export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('booking_id');
  const reason = searchParams.get('reason');

  return (
    <div className="auth-page fade-up">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <XCircle width={32} height={32} strokeWidth={1.75} color="var(--error)" aria-hidden="true" />
        </div>
        <h2 style={{ marginBottom: 8 }}>Payment not completed</h2>
        <p style={{ marginBottom: 32 }}>
          {REASON_COPY[reason] || 'No charge was confirmed.'} Your booking is still reserved — you can retry any time.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {bookingId && (
            <button className="btn btn-primary" onClick={() => navigate(`/payments?bookingId=${bookingId}`)}>Try again</button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/bookings')}>Back to bookings</button>
        </div>
      </div>
    </div>
  );
}
