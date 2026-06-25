import { useState, useEffect } from 'react';
import api, { getErrorMessage } from '../utils/api';

export default function Profile() {
  const [profile, setProfile] = useState({ bio: '', skills: '', hourly_rate: '', availability_days: '', profile_photo_url: '' });
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users/me').then(res => {
      setProfile({
        bio: res.data.bio || '',
        skills: res.data.skills?.join(', ') || '',
        hourly_rate: res.data.hourly_rate || '',
        availability_days: res.data.availability_days?.join(', ') || '',
        profile_photo_url: res.data.profile_photo_url || ''
      });
    }).catch(() => {});
  }, []);

  const handleChange = e => setProfile({ ...profile, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch('/users/profile', {
        ...profile,
        skills: profile.skills.split(',').map(s => s.trim()).filter(Boolean),
        availability_days: profile.availability_days.split(',').map(s => s.trim()).filter(Boolean),
        hourly_rate: profile.hourly_rate ? Number(profile.hourly_rate) : undefined
      });
      setAlert({ type: 'alert-success', msg: 'Profile updated successfully!' });
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    } finally { setLoading(false); }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/users/me/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', 'my-data.json');
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    }
  };

  return (
    <div className="page fade-up" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <h1>Profile settings</h1>
          <p style={{ marginTop: 4 }}>Manage your tutor profile and account data</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export my data</button>
      </div>

      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Profile photo URL</label>
            <input type="text" name="profile_photo_url" value={profile.profile_photo_url} onChange={handleChange} placeholder="https://example.com/photo.jpg" />
          </div>

          <div className="form-group">
            <label>Bio</label>
            <textarea name="bio" rows={4} value={profile.bio} onChange={handleChange} placeholder="Tell learners about your background and teaching style…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Skills <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(comma-separated)</span></label>
              <input type="text" name="skills" value={profile.skills} onChange={handleChange} placeholder="React, Node.js, Design" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hourly rate (NPR)</label>
              <input type="number" name="hourly_rate" value={profile.hourly_rate} onChange={handleChange} placeholder="500" min="0" />
            </div>
          </div>

          <div className="form-group">
            <label>Availability <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(comma-separated days)</span></label>
            <input type="text" name="availability_days" value={profile.availability_days} onChange={handleChange} placeholder="Monday, Wednesday, Friday" />
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
