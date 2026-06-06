import { useState, useEffect } from 'react';
import api, { getErrorMessage } from '../utils/api';

export default function Profile() {
  const [profile, setProfile] = useState({
    bio: '',
    skills: '',
    hourly_rate: '',
    availability_days: '',
    profile_photo_url: ''
  });
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    // Fetch initial profile data
    api.get('/users/me').then(res => {
      setProfile({
        bio: res.data.bio || '',
        skills: res.data.skills?.join(', ') || '',
        hourly_rate: res.data.hourly_rate || '',
        availability_days: res.data.availability_days?.join(', ') || '',
        profile_photo_url: res.data.profile_photo_url || ''
      });
    }).catch(err => console.error(err));
  }, []);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Parse comma separated strings back to arrays
      const payload = {
        ...profile,
        skills: profile.skills.split(',').map(s => s.trim()).filter(Boolean),
        availability_days: profile.availability_days.split(',').map(s => s.trim()).filter(Boolean),
        hourly_rate: profile.hourly_rate ? Number(profile.hourly_rate) : undefined
      };

      await api.patch('/users/profile', payload);
      setAlert({ type: 'alert-success', msg: 'Profile updated successfully!' });
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/users/me/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'user-data-export.json');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      setAlert({ type: 'alert-error', msg: 'Data export limit reached or error occurred.' });
    }
  };

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Profile Settings</h2>
          <p className="subtitle" style={{ textAlign: 'left', marginTop: '0.25rem' }}>Manage your account and tutor profile.</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>Export My Data</button>
      </div>

      {alert && (
        <div className={`alert ${alert.type}`}>
          {alert.msg}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Profile Photo URL</label>
            <input 
              type="text" name="profile_photo_url" 
              value={profile.profile_photo_url} onChange={handleChange}
              placeholder="https://example.com/avatar.jpg" 
            />
          </div>

          <div className="form-group">
            <label>Bio</label>
            <textarea 
              name="bio"
              rows={4} 
              value={profile.bio} onChange={handleChange}
              placeholder="Tell students about your experience..."
              style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical' }}
            ></textarea>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Skills (comma separated)</label>
              <input 
                type="text" name="skills" 
                value={profile.skills} onChange={handleChange}
                placeholder="React, Node.js, Design" 
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hourly Rate ($)</label>
              <input 
                type="number" name="hourly_rate" 
                value={profile.hourly_rate} onChange={handleChange}
                placeholder="50" min="0" 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Availability Days (comma separated)</label>
            <input 
              type="text" name="availability_days" 
              value={profile.availability_days} onChange={handleChange}
              placeholder="Monday, Wednesday, Friday" 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary">Save Profile</button>
          </div>
        </form>
      </div>
    </div>
  );
}
