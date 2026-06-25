import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../utils/api';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  const isLoggedIn = !!localStorage.getItem('accessToken');

  const handleLogout = async () => {
    try { await authApi.post('/logout'); } catch (_) {}
    localStorage.removeItem('accessToken');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

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
