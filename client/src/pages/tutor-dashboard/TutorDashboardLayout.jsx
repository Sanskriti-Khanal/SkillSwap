import { Outlet, Link, useLocation, useOutletContext, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, ClipboardList, CalendarDays, CalendarClock, Wallet,
  ArrowDownToLine, MessageSquare, Star, BarChart3, Settings, Lock,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { path: 'listings', label: 'My Listings', icon: ClipboardList },
  { path: 'courses', label: 'Courses', soon: true, icon: BookOpen },
  { path: 'bookings', label: 'Bookings', icon: CalendarDays },
  { path: 'availability', label: 'Calendar & Availability', icon: CalendarClock },
  { path: 'wallet', label: 'Wallet', soon: true, icon: Wallet },
  { path: 'withdrawals', label: 'Withdrawals', soon: true, icon: ArrowDownToLine },
  { path: 'messages', label: 'Messages', soon: true, icon: MessageSquare },
  { path: 'reviews', label: 'Reviews', icon: Star },
  { path: 'analytics', label: 'Analytics', soon: true, icon: BarChart3 },
  { path: 'settings', label: 'Settings', icon: Settings },
];

export default function TutorDashboardLayout() {
  const { user } = useOutletContext();
  const location = useLocation();

  const isTutor = user && ['tutor', 'both', 'admin'].includes(user.role);
  if (!isTutor) {
    return <Navigate to="/tutor/application/status" replace />;
  }

  const base = '/tutor/dashboard';

  function isActive(path, end) {
    const full = path ? `${base}/${path}` : base;
    return end ? location.pathname === full : location.pathname.startsWith(full);
  }

  return (
    <div className="sidebar-layout">
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.path ? `${base}/${item.path}` : base}
              className={`sidebar-link ${isActive(item.path, item.end) ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <Icon className="icon-inline" style={{ width: 17, height: 17 }} aria-hidden="true" />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.soon && <Lock style={{ width: 14, height: 14 }} strokeWidth={2} aria-label="Coming soon" />}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-content">
        <Outlet context={{ user }} />
      </div>
    </div>
  );
}
