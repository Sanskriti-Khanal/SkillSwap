import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get('/bookings');
        setBookings(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'var(--success)';
      case 'cancelled': return 'var(--error)';
      case 'confirmed': return '#3B82F6'; // Blue
      default: return 'var(--text-primary)'; // pending
    }
  };

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <h2>Bookings History</h2>
      </div>

      {loading ? (
        <p>Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '1rem' }}>
          <div style={{ position: 'absolute', left: '15px', top: '10px', bottom: '10px', width: '1px', backgroundColor: 'var(--border-color)' }}></div>
          
          {bookings.map((booking, index) => (
            <div key={booking._id} style={{ position: 'relative', paddingLeft: '2.5rem', marginBottom: index === bookings.length - 1 ? 0 : '2.5rem' }}>
              <div style={{ position: 'absolute', left: '-5px', top: '4px', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: 'var(--bg-color)', border: `2px solid ${getStatusColor(booking.status)}` }}></div>
              
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                {new Date(booking.requested_time).toLocaleString()}
              </p>
              <div className="card" style={{ padding: '1.25rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{booking.listing_id?.title || 'Unknown Listing'}</h3>
                    <p style={{ fontSize: '0.875rem' }}>
                      Tutor: {booking.tutor_id?.email} | Learner: {booking.learner_id?.email}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: getStatusColor(booking.status), textTransform: 'uppercase' }}>
                    {booking.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
