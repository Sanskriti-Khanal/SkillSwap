import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Mail, GraduationCap, MonitorPlay, BarChart3, Star,
  DollarSign, Clock, Globe, ExternalLink,
} from 'lucide-react';
import api, { getErrorMessage } from '../utils/api';
import StarRating from '../components/StarRating';

const ORBIT_ICONS = [Mail, GraduationCap, MonitorPlay, BarChart3, Star];
const ORBIT_RADIUS = 110;

function OrbitRing() {
  return (
    <div className="tutor-orbit-ring" aria-hidden="true">
      {ORBIT_ICONS.map((Icon, i) => {
        const angle = (360 / ORBIT_ICONS.length) * i;
        return (
          <div
            key={i}
            className="tutor-orbit-item"
            style={{ transform: `rotate(${angle}deg) translate(${ORBIT_RADIUS}px) rotate(${-angle}deg)` }}
          >
            <div className="tutor-orbit-item-inner">
              <div className="icon-badge icon-badge-orange icon-badge-sm">
                <Icon aria-hidden="true" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

  const { user, profile } = data;
  const displayName = profile?.display_name || user.email.split('@')[0];
  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;
  const links = profile?.experience?.portfolio_links || {};

  return (
    <div className="page fade-up">
      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

      <div className="tutor-hero">
        <div className="tutor-orbit-wrap">
          {user.profile_photo_url ? (
            <img src={user.profile_photo_url} alt={displayName} className="tutor-hero-photo" />
          ) : (
            <div className="tutor-hero-photo">{displayName[0]?.toUpperCase()}</div>
          )}
          <OrbitRing />
        </div>

        <h1 style={{ marginBottom: 4 }}>{displayName}</h1>
        {profile?.professional_headline && (
          <p style={{ fontSize: '1.0625rem', fontWeight: 500, color: 'var(--dark)' }}>{profile.professional_headline}</p>
        )}

        <div className="tutor-detail-row">
          {profile?.skills?.primary_category && (
            <span className="badge badge-orange" style={{ fontSize: '.8125rem', padding: '6px 14px' }}>{profile.skills.primary_category}</span>
          )}
          {avgRating !== null && (
            <span className="tutor-detail-pill"><StarRating rating={Math.round(avgRating)} size={13} /> {avgRating.toFixed(1)} ({reviews.length})</span>
          )}
          {profile?.skills?.hourly_rate != null && (
            <span className="tutor-detail-pill"><DollarSign className="icon-inline" aria-hidden="true" /> {profile.skills.hourly_rate} {profile.skills.currency}/session</span>
          )}
          {profile?.skills?.teaching_mode && (
            <span className="tutor-detail-pill"><MonitorPlay className="icon-inline" aria-hidden="true" /> {profile.skills.teaching_mode}</span>
          )}
          {profile?.skills?.timezone && (
            <span className="tutor-detail-pill"><Clock className="icon-inline" aria-hidden="true" /> {profile.skills.timezone}</span>
          )}
        </div>

        {(profile?.bio || user.bio) && (
          <p style={{ maxWidth: 640, marginTop: 8 }}>{profile?.bio || user.bio}</p>
        )}

        {(links.website || links.github || links.linkedin) && (
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            {links.website && <a href={links.website} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><Globe className="icon-inline" aria-hidden="true" /> Website</a>}
            {links.github && <a href={links.github} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><ExternalLink className="icon-inline" aria-hidden="true" /> GitHub</a>}
            {links.linkedin && <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><ExternalLink className="icon-inline" aria-hidden="true" /> LinkedIn</a>}
          </div>
        )}
      </div>

      <div className="divider" />

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

      <h2 style={{ marginBottom: 20 }}>Listings</h2>
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
