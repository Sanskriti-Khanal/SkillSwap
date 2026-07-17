import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import api, { authApi } from '../utils/api';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  const isLoggedIn = !!localStorage.getItem('accessToken');
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    api.get('/users/me').then((r) => setRole(r.data.role)).catch(() => {});
  }, [isLoggedIn]);

  const handleLogout = async () => {
    try { await authApi.post('/logout'); } catch (_) {}
    localStorage.removeItem('accessToken');
    navigate('/login');
  };

  const isActive = (path) => location.pathname.startsWith(path) ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <img src="/images/image copy 2.png" alt="SkillSwap Logo" style={{ height: 48, width: 'auto' }} />
        <span style={{ color: '#1A1512', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>SkillSwap</span>
      </Link>

      {!isAuthPage && isLoggedIn && (
        <div className="navbar-nav">
          <Link to="/dashboard" className={isActive('/dashboard')}>Dashboard</Link>
          <Link to="/listings"  className={isActive('/listings')}>Browse</Link>
          <Link to="/bookings"  className={isActive('/bookings')}>Bookings</Link>
          {role === 'admin' && (
            <Link to="/admin/tutor-applications" className={isActive('/admin/tutor-applications')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck className="icon-inline" aria-hidden="true" />
              Admin
            </Link>
          )}
        </div>
      )}

      <div className="navbar-actions">
        {isAuthPage ? (
          <>
            <Link to="/login"    className="btn btn-ghost btn-sm">Log in</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
          </>
        ) : isLoggedIn ? (
          <>
            <NotificationBell />
            <Link to="/profile" className="avatar" title="Profile">ME</Link>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">Log in</Link>
        )}
      </div>
    </nav>
  );
}
