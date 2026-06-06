import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
        <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--text-primary)', borderRadius: '4px' }}></div>
        SkillSwap
      </Link>
      
      {!isAuthPage && (
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          <Link to="/dashboard" style={{ color: location.pathname === '/dashboard' ? 'var(--text-primary)' : '' }}>Dashboard</Link>
          <Link to="/listings" style={{ color: location.pathname === '/listings' ? 'var(--text-primary)' : '' }}>Listings</Link>
          <Link to="/bookings" style={{ color: location.pathname === '/bookings' ? 'var(--text-primary)' : '' }}>Bookings</Link>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isAuthPage ? (
          <>
            <Link to="/login" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Log in</Link>
            <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Sign up</Link>
          </>
        ) : (
          <>
            <Link to="/profile" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600 }}>US</Link>
          </>
        )}
      </div>
    </nav>
  );
}
