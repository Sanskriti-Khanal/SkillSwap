import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, ClipboardList, DollarSign, Search, CalendarDays, User, GraduationCap } from 'lucide-react';
import api from '../utils/api';

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get('/users/me').then(r => setUser(r.data)).catch(() => {});
  }, []);

  const isTutor = user && ['tutor', 'both', 'admin'].includes(user.role);

  return (
    <div className="page fade-up">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <h1>Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--body)', lineHeight: 1.65 }}>
              Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
            </span>
            {user?.role && <span className="badge badge-orange" style={{ marginLeft: 8 }}>{user.role}</span>}
          </div>
          {user && isTutor && (
            <span className="badge badge-green" aria-label="You are a tutor" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '.875rem' }}>
              <GraduationCap className="icon-inline" aria-hidden="true" />
              Verified tutor
            </span>
          )}
        </div>
        <div className="dashboard-header-right">
          {user && (
            isTutor ? (
              <Link to="/tutor/dashboard" className="btn btn-secondary" aria-label="Go to tutor dashboard">
                Go to Tutor Dashboard
              </Link>
            ) : (
              <Link to="/tutor/apply" className="btn btn-secondary" aria-label="Apply to become a tutor" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <GraduationCap className="icon-inline" aria-hidden="true" />
                Become a Tutor
              </Link>
            )
          )}
          <Link to="/listings" className="btn btn-primary">Browse skills</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><Calendar aria-hidden="true" /></div>
          <div className="stat-label">Upcoming sessions</div>
          <div className="stat-value">—</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><CheckCircle2 aria-hidden="true" /></div>
          <div className="stat-label">Completed</div>
          <div className="stat-value">—</div>
        </div>
        {isTutor && (
          <>
            <div className="stat-card">
              <div className="stat-icon"><ClipboardList aria-hidden="true" /></div>
              <div className="stat-label">Active listings</div>
              <div className="stat-value">—</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><DollarSign aria-hidden="true" /></div>
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
          <div className="icon-badge icon-badge-orange"><Search aria-hidden="true" /></div>
          <strong style={{ color: 'var(--dark)' }}>Browse listings</strong>
          <p style={{ fontSize: '.875rem' }}>Find a tutor for any skill</p>
        </Link>
        <Link to="/bookings" className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', textDecoration: 'none' }}>
          <div className="icon-badge icon-badge-orange"><CalendarDays aria-hidden="true" /></div>
          <strong style={{ color: 'var(--dark)' }}>My bookings</strong>
          <p style={{ fontSize: '.875rem' }}>View and manage sessions</p>
        </Link>
        <Link to="/profile" className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', textDecoration: 'none' }}>
          <div className="icon-badge icon-badge-orange"><User aria-hidden="true" /></div>
          <strong style={{ color: 'var(--dark)' }}>Edit profile</strong>
          <p style={{ fontSize: '.875rem' }}>Update skills and availability</p>
        </Link>
      </div>
    </div>
  );
}
