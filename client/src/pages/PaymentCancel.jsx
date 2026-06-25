import { useSearchParams, useNavigate } from 'react-router-dom';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('booking_id');

  return (
    <div className="auth-page fade-up">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', margin: '0 auto 24px' }}>❌</div>
        <h2 style={{ marginBottom: 8 }}>Payment cancelled</h2>
        <p style={{ marginBottom: 32 }}>No charge was made. Your booking is still reserved — you can retry any time.</p>
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
