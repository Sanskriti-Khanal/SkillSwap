import { useNavigate } from 'react-router-dom';

export default function PaymentSuccess() {
  const navigate = useNavigate();

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '500px', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✓</div>
      <h2 style={{ marginBottom: '1rem' }}>Payment Successful</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Your booking has been confirmed. Check your Bookings page for details.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/bookings')}>
        View My Bookings
      </button>
    </div>
  );
}
