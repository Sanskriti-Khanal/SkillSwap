import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get('/users/me').then(r => setUser(r.data)).catch(() => {});
  }, []);

  const isTutor = user && ['tutor', 'both', 'admin'].includes(user.role);

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p style={{ marginTop: 4 }}>
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
            {user?.role && <span className="badge badge-orange" style={{ marginLeft: 8 }}>{user.role}</span>}
          </p>
        </div>
        <Link to="/listings" className="btn btn-primary">Browse skills</Link>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-label">Upcoming sessions</div>
          <div className="stat-value">—</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-label">Completed</div>
          <div className="stat-value">—</div>
        </div>
        {isTutor && (
          <>
            <div className="stat-card">
              <div className="stat-icon">📋</div>
              <div className="stat-label">Active listings</div>
              <div className="stat-value">—</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-label">Total earnings</div>
              <div className="stat-value">—</div>
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      <h2 style={{ marginBottom: 20 }}>Quick actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
        <Link to="/listings" className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', textDecoration: 'none' }}>
          <span style={{ fontSize: '1.5rem' }}>🔍</span>
          <strong style={{ color: 'var(--dark)' }}>Browse listings</strong>
          <p style={{ fontSize: '.875rem' }}>Find a tutor for any skill</p>
        </Link>
        <Link to="/bookings" className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', textDecoration: 'none' }}>
          <span style={{ fontSize: '1.5rem' }}>📆</span>
          <strong style={{ color: 'var(--dark)' }}>My bookings</strong>
          <p style={{ fontSize: '.875rem' }}>View and manage sessions</p>
        </Link>
        <Link to="/profile" className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', textDecoration: 'none' }}>
          <span style={{ fontSize: '1.5rem' }}>👤</span>
          <strong style={{ color: 'var(--dark)' }}>Edit profile</strong>
          <p style={{ fontSize: '.875rem' }}>Update skills and availability</p>
        </Link>
      </div>
    </div>
  );
}
