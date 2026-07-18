import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import api from '../utils/api';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestedTime, setRequestedTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    api.get(`/listings/${id}`).then(r => setListing(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleBook = async () => {
    setAlert(null);
    if (!requestedTime) { setAlert({ type: 'alert-error', msg: 'Please select a date and time.' }); return; }
    setBusy(true);
    try {
      await api.post('/bookings', { listing_id: id, requested_time: requestedTime });
      setAlert({ type: 'alert-success', msg: 'Booking created! Go to My Bookings to pay.' });
      setBooked(true);
    } catch (err) {
      setAlert({ type: 'alert-error', msg: err.response?.data?.msg || 'Failed to create booking.' });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="page"><p>Loading…</p></div>;
  if (!listing) return <div className="page"><p>Listing not found.</p></div>;

  const tutor = listing.tutor_id;

  return (
    <div className="page fade-up" style={{ maxWidth: 900 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/listings')} style={{ marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft className="icon-inline" aria-hidden="true" /> Back to listings
      </button>

      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Left: details */}
        <div style={{ flex: '2 1 400px' }}>
          <span className="badge badge-orange" style={{ marginBottom: 12 }}>{listing.skill_category}</span>
          <h1 style={{ marginBottom: 16 }}>{listing.title}</h1>

          {tutor && (
            <Link
              to={`/tutors/${tutor._id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', textDecoration: 'none' }}
            >
              <div className="tutor-avatar" style={{ width: 44, height: 44, fontSize: '.875rem', flexShrink: 0 }}>
                {tutor.email?.[0]?.toUpperCase() ?? 'T'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: '.9375rem', color: 'var(--dark)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tutor.email}</strong>
                {tutor.bio && <p style={{ fontSize: '.8125rem', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tutor.bio}</p>}
              </div>
              <span style={{ fontSize: '.8125rem', color: 'var(--orange)', fontWeight: 600, flexShrink: 0 }}>View profile →</span>
            </Link>
          )}

          <div className="divider" />
          <h3 style={{ margin: '24px 0 12px' }}>About this session</h3>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{listing.description}</p>

          <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap' }}>
            <div className="stat-card" style={{ flex: '1 1 140px' }}>
              <div className="stat-label">Duration</div>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>{listing.duration_minutes} min</div>
            </div>
            <div className="stat-card" style={{ flex: '1 1 140px' }}>
              <div className="stat-label">Price</div>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>NPR {listing.price_per_session?.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Right: booking card */}
        <div style={{ flex: '1 1 260px', position: 'sticky', top: 80 }}>
          <div className="card" style={{ padding: 28 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '.8125rem', color: 'var(--muted)', marginBottom: 2 }}>Price per session</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--dark)' }}>NPR {listing.price_per_session?.toLocaleString()}</div>
            </div>

            {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

            {!booked ? (
              <>
                <div className="form-group">
                  <label>Select date & time</label>
                  <input type="datetime-local" value={requestedTime} onChange={e => setRequestedTime(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
                </div>
                <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleBook} disabled={busy}>
                  {busy ? 'Booking…' : 'Book session'}
                </button>
              </>
            ) : (
              <button className="btn btn-secondary btn-lg" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => navigate('/bookings')}>
                View my bookings <ArrowRight className="icon-inline" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
