import { useState, useEffect } from 'react';
import api from '../utils/api';

function ReviewModal({ booking, onClose, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/reviews', { booking_id: booking._id, rating, comment });
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Leave a Review</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {booking.listing_id?.title}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rating (1–5)</label>
            <input
              type="number" min="1" max="5" value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              required
            />
          </div>
          <div className="form-group">
            <label>Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4} required
              style={{ resize: 'vertical', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', width: '100%', fontSize: '0.875rem' }}
            />
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState(null);

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

  useEffect(() => { fetchBookings(); }, []);

  const canReview = (booking) =>
    (booking.status === 'confirmed' || booking.status === 'completed') &&
    new Date(booking.requested_time) < new Date();

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'var(--success)';
      case 'cancelled': return 'var(--error)';
      case 'confirmed': return '#3B82F6';
      default: return 'var(--text-primary)';
    }
  };

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '800px' }}>
      {reviewTarget && (
        <ReviewModal
          booking={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmitted={fetchBookings}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <h2>Bookings History</h2>
      </div>

      {loading ? (
        <p>Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '1rem' }}>
          <div style={{ position: 'absolute', left: '15px', top: '10px', bottom: '10px', width: '1px', backgroundColor: 'var(--border-color)' }} />

          {bookings.map((booking, index) => (
            <div key={booking._id} style={{ position: 'relative', paddingLeft: '2.5rem', marginBottom: index === bookings.length - 1 ? 0 : '2.5rem' }}>
              <div style={{
                position: 'absolute', left: '-5px', top: '4px',
                width: '11px', height: '11px', borderRadius: '50%',
                backgroundColor: 'var(--bg-color)',
                border: `2px solid ${getStatusColor(booking.status)}`
              }} />

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                {new Date(booking.requested_time).toLocaleString()}
              </p>

              <div className="card" style={{ padding: '1.25rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>
                      {booking.listing_id?.title || 'Unknown Listing'}
                    </h3>
                    <p style={{ fontSize: '0.875rem' }}>
                      Tutor: {booking.tutor_id?.email} | Learner: {booking.learner_id?.email}
                    </p>
                    {canReview(booking) && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginTop: '0.5rem' }}
                        onClick={() => setReviewTarget(booking)}
                      >
                        Leave Review
                      </button>
                    )}
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
