import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

function ReviewModal({ booking, onClose, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/reviews', { booking_id: booking._id, rating, comment });
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to submit review.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,50,47,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: 32 }}>
        <h3 style={{ marginBottom: 4 }}>Leave a review</h3>
        <p style={{ fontSize: '.875rem', marginBottom: 24 }}>{booking.listing_id?.title}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rating (1–5 stars)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)}
                  style={{ width: 40, height: 40, borderRadius: 8, border: '1.5px solid', borderColor: n <= rating ? 'var(--orange)' : 'var(--border)', background: n <= rating ? 'var(--orange-light)' : 'var(--surface)', color: n <= rating ? 'var(--orange)' : 'var(--muted)', fontWeight: 700, cursor: 'pointer' }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Your comment</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} required placeholder="Share your experience…" />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Submitting…' : 'Submit review'}</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const STATUS_BADGE = {
  pending:   'badge-yellow',
  confirmed: 'badge-green',
  cancelled: 'badge-red',
  completed: 'badge-neutral',
  refunded:  'badge-purple',
};

export default function Bookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState(null);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings');
      setBookings(res.data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBookings(); }, []);

  const canReview = (b) => ['confirmed','completed'].includes(b.status) && new Date(b.requested_time) < new Date();

  return (
    <div className="page fade-up">
      {reviewTarget && <ReviewModal booking={reviewTarget} onClose={() => setReviewTarget(null)} onSubmitted={fetchBookings} />}

      <div className="page-header">
        <h1>My Bookings</h1>
      </div>

      {loading ? (
        <div className="empty"><div className="empty-icon">⏳</div><h3>Loading…</h3></div>
      ) : bookings.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <h3>No bookings yet</h3>
          <p style={{ marginBottom: 20 }}>Browse listings to book your first session</p>
          <a href="/listings" className="btn btn-primary">Browse skills</a>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Date & Time</th>
                <th>Tutor</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b._id}>
                  <td>
                    <strong>{b.listing_id?.title ?? 'Unknown listing'}</strong>
                    {b.listing_id?.duration_minutes && <div style={{ fontSize: '.8125rem', color: 'var(--muted)', marginTop: 2 }}>{b.listing_id.duration_minutes} min</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '.875rem' }}>
                    {new Date(b.requested_time).toLocaleDateString()}<br />
                    <span style={{ color: 'var(--muted)' }}>{new Date(b.requested_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td style={{ fontSize: '.875rem' }}>{b.tutor_id?.email ?? '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[b.status] ?? 'badge-neutral'}`}>{b.status}</span>
                  </td>
                  <td>
                    <span className={`status status-${b.payment_status}`} style={{ fontSize: '.875rem' }}>
                      {b.payment_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {b.payment_status === 'unpaid' && b.status === 'pending' && (
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/payments?bookingId=${b._id}`)}>Pay now</button>
                      )}
                      {canReview(b) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setReviewTarget(b)}>Review</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
