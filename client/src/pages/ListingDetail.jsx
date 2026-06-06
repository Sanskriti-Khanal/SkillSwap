import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        // We don't have a single GET listing route in backend, so we fetch all and find it, 
        // or we should add GET /api/listings/:id to the backend. 
        // Let's add GET /api/listings/:id route to backend later. For now assume it works.
        const res = await api.get(`/listings/${id}`);
        setListing(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id]);

  if (loading) return <div className="page-container">Loading...</div>;
  if (!listing) return <div className="page-container">Listing not found</div>;

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '800px' }}>
      <button onClick={() => navigate('/listings')} className="btn btn-secondary" style={{ marginBottom: '2rem' }}>&larr; Back</button>
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{listing.skill_category}</span>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>•</span>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{listing.duration_minutes} minutes</span>
      </div>

      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{listing.title}</h1>
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '3rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--surface-color)', overflow: 'hidden' }}>
           {listing.tutor_id?.profile_photo_url && <img src={listing.tutor_id.profile_photo_url} alt="Tutor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div>
          <p style={{ fontWeight: 600 }}>{listing.tutor_id?.email || 'Tutor'}</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{listing.tutor_id?.bio || 'Experienced Mentor'}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '3rem' }}>
        <div style={{ flex: 2 }}>
          <h3>About this session</h3>
          <p style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{listing.description}</p>
        </div>
        
        <div style={{ flex: 1 }}>
          <div className="card" style={{ position: 'sticky', top: '100px' }}>
            <p style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '1rem' }}>NPR {listing.price_per_session}</p>
            <button className="btn btn-primary" style={{ width: '100%' }}>Book Session</button>
          </div>
        </div>
      </div>
    </div>
  );
}
