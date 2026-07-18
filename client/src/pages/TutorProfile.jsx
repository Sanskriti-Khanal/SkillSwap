import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import api, { getErrorMessage } from '../utils/api';
import StarRating from '../components/StarRating';
import Hero from '../components/TutorHero/Hero';

export default function TutorProfile() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/users/${id}/public-profile`),
      api.get(`/listings?tutor_id=${id}`),
      api.get(`/reviews/tutor/${id}`),
    ])
      .then(([profileRes, listingsRes, reviewsRes]) => {
        setData(profileRes.data);
        setListings(listingsRes.data.listings || []);
        setReviews(reviewsRes.data || []);
      })
      .catch((err) => setAlert({ type: 'alert-error', msg: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page"><p>Loading…</p></div>;
  if (!data) return <div className="page"><div className="alert alert-error">{alert?.msg || 'Tutor not found'}</div></div>;

  const { profile } = data;

  return (
    <div className="page fade-up">
      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

      <Hero data={data} reviews={reviews} />

      <div className="divider" style={{ marginTop: 40 }} />

      {profile?.skills?.sub_skills?.length > 0 && (
        <>
          <h2 style={{ marginBottom: 16 }}>Skills</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
            {profile.skills.sub_skills.map((s) => <span key={s} className="badge badge-neutral">{s}</span>)}
          </div>
        </>
      )}

      {profile?.education?.highest_education && (
        <>
          <h2 style={{ marginBottom: 16 }}>Education</h2>
          <div className="card" style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-badge icon-badge-orange"><GraduationCap aria-hidden="true" /></div>
            <div>
              <strong style={{ color: 'var(--dark)', textTransform: 'capitalize' }}>{profile.education.highest_education.replace('_', ' ')}</strong>
              {profile.education.field_of_study && <p style={{ fontSize: '.875rem' }}>{profile.education.field_of_study}{profile.education.institution_name && ` · ${profile.education.institution_name}`}</p>}
            </div>
          </div>
        </>
      )}

      <h2 id="tutor-listings" style={{ marginBottom: 20, scrollMarginTop: 90 }}>Listings</h2>
      {listings.length === 0 ? (
        <p style={{ marginBottom: 32 }}>This tutor doesn't have any active listings yet.</p>
      ) : (
        <div className="listing-grid" style={{ marginBottom: 32 }}>
          {listings.map((l) => (
            <Link key={l._id} to={`/listings/${l._id}`} className="listing-card">
              <span className="listing-category">{l.skill_category}</span>
              <span className="listing-title">{l.title}</span>
              <p className="listing-desc">{l.description}</p>
              <div className="listing-footer">
                <span className="listing-price">NPR {l.price_per_session?.toLocaleString()}</span>
                <span className="listing-duration">{l.duration_minutes} min</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2 style={{ marginBottom: 20 }}>Reviews {reviews.length > 0 && `(${reviews.length})`}</h2>
      {reviews.length === 0 ? (
        <p>No reviews yet.</p>
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
