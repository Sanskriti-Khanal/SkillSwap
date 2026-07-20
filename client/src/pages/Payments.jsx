import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import khaltiLogo from '../assets/khalti.png';

export default function Payments() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('bookingId');

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided.');
      setLoading(false);
      return;
    }
    const fetchBooking = async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}`);
        setBooking(res.data);
      } catch (err) {
        setError(err.response?.data?.msg || 'Failed to load booking.');
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId]);

  const handlePay = async () => {
    setError('');
    setRedirecting(true);
    try {
      const res = await api.post('/payments/initiate', { booking_id: bookingId });
      // Redirect to Khalti's hosted checkout
      window.location.href = res.data.payment_url;
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to start payment session.');
      setRedirecting(false);
    }
  };

  if (loading) return <div className="page-container">Loading booking...</div>;

  if (error && !booking) {
    return (
      <div className="page-container animate-fade-in" style={{ maxWidth: '600px' }}>
        <p style={{ color: 'var(--error)' }}>{error}</p>
        <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/bookings')}>
          Back to Bookings
        </button>
      </div>
    );
  }

  const listing = booking?.listing_id;
  const alreadyPaid = booking?.payment_status === 'paid';

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '600px' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2>Complete your booking</h2>
        <p className="subtitle" style={{ marginTop: '0.5rem' }}>{listing?.title}</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed var(--border-color)' }}>
          <span>{listing?.duration_minutes} min session</span>
          <span style={{ fontWeight: 600 }}>NPR {listing?.price_per_session}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Scheduled</span>
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
            {booking?.requested_time ? new Date(booking.requested_time).toLocaleString() : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem' }}>
          <span style={{ fontWeight: 600 }}>Total</span>
          <span style={{ fontWeight: 600 }}>NPR {listing?.price_per_session}</span>
        </div>
      </div>

      {alreadyPaid ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--success)', fontWeight: 600, marginBottom: '1rem' }}>This booking has already been paid.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/bookings')}>View Bookings</button>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          {error && <p style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            You will be redirected to Khalti to complete payment securely.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handlePay}
            disabled={redirecting}
          >
            {redirecting ? 'Redirecting to Khalti...' : `Pay NPR ${listing?.price_per_session}`}
          </button>
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Secured by</span>
            <img src={khaltiLogo} alt="Khalti" style={{ height: '18px', width: 'auto' }} />
          </div>
        </div>
      )}
    </div>
  );
}
