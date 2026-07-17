import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ClipboardList } from 'lucide-react';
import api, { getErrorMessage } from '../../utils/api';

const CATEGORIES = ['Programming', 'Design', 'Business', 'Music', 'Language', 'Mathematics', 'Science', 'Other'];
const EMPTY_FORM = { title: '', description: '', skill_category: '', price_per_session: '', duration_minutes: '' };

function ListingFormModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(initial?._id);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        skill_category: form.skill_category,
        price_per_session: Number(form.price_per_session),
        duration_minutes: Number(form.duration_minutes),
      };
      if (isEdit) {
        await api.patch(`/listings/${initial._id}`, payload);
      } else {
        await api.post('/listings', payload);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,50,47,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 32 }}>
        <h3 style={{ marginBottom: 20 }}>{isEdit ? 'Edit listing' : 'Create listing'}</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="e.g. React fundamentals for beginners" required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Category</label>
              <select name="skill_category" value={form.skill_category} onChange={handleChange} required>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input type="number" name="duration_minutes" value={form.duration_minutes} onChange={handleChange} min="15" step="15" required />
            </div>
          </div>
          <div className="form-group">
            <label>Price per session (NPR)</label>
            <input type="number" name="price_per_session" value={form.price_per_session} onChange={handleChange} min="0" required />
          </div>
          <div className="divider" />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save listing'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TutorListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} (create) | listing object (edit)

  function load() {
    setLoading(true);
    api.get('/listings/mine')
      .then((r) => setListings(r.data))
      .catch((err) => setAlert({ type: 'alert-error', msg: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(listing) {
    if (!window.confirm(`Delete "${listing.title}"? This can't be undone.`)) return;
    try {
      await api.delete(`/listings/${listing._id}`);
      setListings((prev) => prev.filter((l) => l._id !== listing._id));
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>My Listings</h1>
        <button className="btn btn-primary" onClick={() => setEditing(EMPTY_FORM)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Plus className="icon-inline" aria-hidden="true" /> New listing
        </button>
      </div>

      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : listings.length === 0 ? (
        <div className="empty">
          <div className="icon-badge icon-badge-neutral icon-badge-lg" style={{ margin: '0 auto 16px' }}><ClipboardList aria-hidden="true" /></div>
          <h3>No listings yet</h3>
          <p style={{ marginBottom: 20 }}>Create your first listing so learners can find and book you.</p>
          <button className="btn btn-primary" onClick={() => setEditing(EMPTY_FORM)}>Create your first listing</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Price</th>
                <th>Duration</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l._id}>
                  <td>{l.title}</td>
                  <td><span className="badge badge-orange">{l.skill_category}</span></td>
                  <td>NPR {l.price_per_session?.toLocaleString()}</td>
                  <td>{l.duration_minutes} min</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(l)} aria-label="Edit listing">
                        <Pencil className="icon-inline" aria-hidden="true" />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(l)} aria-label="Delete listing">
                        <Trash2 className="icon-inline" aria-hidden="true" color="var(--error)" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ListingFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
