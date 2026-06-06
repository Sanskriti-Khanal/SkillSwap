import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function Dashboard() {
  const [role, setRole] = useState('learner');

  useEffect(() => {
    // Fetch current user to get their actual role
    api.get('/users/me').then(res => {
      setRole(res.data.role || 'learner');
    }).catch(err => {
      console.error('Failed to fetch user role', err);
    });
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 65px)' }}>
      {/* Sidebar Navigation */}
      <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.05em' }}>Menu</h3>
        
        <div style={{ padding: '0.5rem 1rem', borderRadius: '4px', backgroundColor: 'var(--surface-color)', fontWeight: 500 }}>
          Overview
        </div>
        <div style={{ padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          My Bookings
        </div>
        
        {/* Role-based Nav Items */}
        {(role === 'tutor' || role === 'both' || role === 'admin') && (
          <>
            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginTop: '2rem', marginBottom: '1rem', letterSpacing: '0.05em' }}>Tutor Tools</h3>
            <div style={{ padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              My Listings
            </div>
            <div style={{ padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              Earnings
            </div>
            <div style={{ padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              Availability
            </div>
          </>
        )}

        {role === 'admin' && (
          <>
            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginTop: '2rem', marginBottom: '1rem', letterSpacing: '0.05em' }}>Admin</h3>
            <div style={{ padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              Manage Users
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="page-container animate-fade-in" style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>Dashboard</h2>
          <button className="btn btn-primary" onClick={() => {
            // For demonstration, toggle role
            setRole(role === 'learner' ? 'tutor' : role === 'tutor' ? 'admin' : 'learner');
          }}>Toggle Role View (Demo)</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className="card">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Upcoming Sessions</p>
            <p style={{ fontSize: '2rem', fontWeight: 600 }}>5</p>
          </div>
          {(role === 'tutor' || role === 'both' || role === 'admin') && (
            <>
              <div className="card">
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Active Listings</p>
                <p style={{ fontSize: '2rem', fontWeight: 600 }}>3</p>
              </div>
              <div className="card">
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total Earnings</p>
                <p style={{ fontSize: '2rem', fontWeight: 600 }}>$1,240</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
