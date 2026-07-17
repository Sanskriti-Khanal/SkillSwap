import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import api, { getErrorMessage } from '../../utils/api';
import StarRating from '../../components/StarRating';

export default function TutorReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    api.get('/reviews/tutor/me')
      .then((r) => setReviews(r.data))
      .catch((err) => setAlert({ type: 'alert-error', msg: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Reviews</h1>
      </div>
      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : reviews.length === 0 ? (
        <div className="empty">
          <div className="icon-badge icon-badge-neutral icon-badge-lg" style={{ margin: '0 auto 16px' }}><Star aria-hidden="true" /></div>
          <h3>No reviews yet</h3>
          <p>Reviews from your students will show up here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map((r) => (
            <div key={r._id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>{r.listing_id?.title || 'Session'}</strong>
                <StarRating rating={r.rating} />
              </div>
              <p>{r.comment}</p>
              <div style={{ fontSize: '.8125rem', color: 'var(--muted)', marginTop: 8 }}>
                {r.learner_id?.email} · {new Date(r.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
