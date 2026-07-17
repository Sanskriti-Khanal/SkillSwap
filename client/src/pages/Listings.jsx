import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, Inbox } from 'lucide-react';
import api from '../utils/api';

const CATEGORIES = ['Programming', 'Design', 'Business', 'Music', 'Language', 'Mathematics', 'Science', 'Other'];

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('skill_category', category);
      if (search)   params.set('keyword', search);
      const res = await api.get(`/listings?${params}`);
      setListings(res.data.listings ?? []);
    } catch (_) {
      setListings([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchListings(); }, [category, search]);

  const handleSearch = (e) => { e.preventDefault(); setSearch(keyword); };

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div>
          <h1>Browse Skills</h1>
          <p style={{ marginTop: 4 }}>Find expert tutors for any subject</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32, alignItems: 'center' }}>
        <form onSubmit={handleSearch} className="search-wrap" style={{ flex: '1 1 260px' }}>
          <span className="search-icon"><Search aria-hidden="true" /></span>
          <input
            type="text"
            placeholder="Search by title…"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </form>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ flex: '0 0 auto', maxWidth: 200 }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(category || search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setCategory(''); setKeyword(''); setSearch(''); }}>
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty"><div className="icon-badge icon-badge-neutral icon-badge-lg" style={{ margin: '0 auto 16px' }}><Loader2 className="spin" aria-hidden="true" /></div><h3>Loading…</h3></div>
      ) : listings.length === 0 ? (
        <div className="empty">
          <div className="icon-badge icon-badge-neutral icon-badge-lg" style={{ margin: '0 auto 16px' }}><Inbox aria-hidden="true" /></div>
          <h3>No listings found</h3>
          <p>Try a different search or category</p>
        </div>
      ) : (
        <div className="listing-grid">
          {listings.map(l => (
            <div key={l._id} className="listing-card">
              <Link to={`/listings/${l._id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                <div className="listing-category">{l.skill_category}</div>
                <div className="listing-title">{l.title}</div>
                <div className="listing-desc">{l.description}</div>
              </Link>
              {l.tutor_id && (
                <Link to={`/tutors/${l.tutor_id._id}`} className="tutor-row" style={{ textDecoration: 'none' }}>
                  <div className="tutor-avatar">{l.tutor_id.email?.[0]?.toUpperCase() ?? 'T'}</div>
                  <span style={{ fontSize: '.8125rem', color: 'var(--body)' }}>{l.tutor_id.email}</span>
                </Link>
              )}
              <Link to={`/listings/${l._id}`} className="listing-footer" style={{ textDecoration: 'none' }}>
                <span className="listing-price">NPR {l.price_per_session?.toLocaleString()}</span>
                <span className="listing-duration">{l.duration_minutes} min</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
