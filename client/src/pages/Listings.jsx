import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');

  const fetchListings = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/listings${category ? `?skill_category=${category}` : ''}`);
      setListings(res.data.listings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [category]);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>Marketplace</h2>
          <p className="subtitle" style={{ textAlign: 'left', marginBottom: 0, marginTop: '0.25rem' }}>Find the perfect mentor to upskill.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none' }}
          >
            <option value="">All Categories</option>
            <option value="Programming">Programming</option>
            <option value="Design">Design</option>
            <option value="Business">Business</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p>Loading listings...</p>
      ) : listings.length === 0 ? (
        <p>No listings found.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {listings.map(listing => (
            <Link to={`/listings/${listing._id}`} key={listing._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--surface-color)', borderRadius: '4px', overflow: 'hidden' }}>
                {listing.tutor_id?.profile_photo_url && (
                  <img src={listing.tutor_id.profile_photo_url} alt="Tutor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{listing.skill_category}</span>
                  <span style={{ fontWeight: 600 }}>NPR {listing.price_per_session}</span>
                </div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{listing.title}</h3>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{listing.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
