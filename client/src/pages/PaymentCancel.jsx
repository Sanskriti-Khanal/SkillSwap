import { useSearchParams, useNavigate } from 'react-router-dom';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('booking_id');

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '500px', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✕</div>
      <h2 style={{ marginBottom: '1rem' }}>Payment Cancelled</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Your payment was not completed. Your booking is still reserved — you can try again.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        {bookingId && (
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/payments?bookingId=${bookingId}`)}
          >
            Try Again
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => navigate('/bookings')}>
          Back to Bookings
        </button>
      </div>
    </div>
  );
}
