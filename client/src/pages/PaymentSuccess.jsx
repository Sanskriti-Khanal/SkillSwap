import { useNavigate } from 'react-router-dom';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  return (
    <div className="auth-page fade-up">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', margin: '0 auto 24px' }}>✅</div>
        <h2 style={{ marginBottom: 8 }}>Payment successful!</h2>
        <p style={{ marginBottom: 32 }}>Your booking is confirmed. You'll find the details in My Bookings.</p>
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => navigate('/bookings')}>View my bookings</button>
      </div>
    </div>
  );
}
