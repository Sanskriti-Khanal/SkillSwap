import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../utils/api';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/notifications', { params: { limit: 10 } })
      .then((r) => setUnreadCount(r.data.unreadCount || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      api.get('/notifications', { params: { limit: 10 } })
        .then((r) => { setNotifications(r.data.notifications || []); setUnreadCount(r.data.unreadCount || 0); })
        .catch(() => {});
    }
  }

  async function handleNotificationClick(n) {
    if (!n.read) {
      try {
        await api.patch(`/notifications/${n._id}/read`);
        setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch { /* ignore */ }
    }
    setOpen(false);
    if (n.related_application_id) navigate('/tutor/application/status');
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={toggleOpen}
        aria-label="Notifications"
        style={{ position: 'relative', display: 'inline-flex' }}
      >
        <Bell style={{ width: 19, height: 19 }} strokeWidth={1.75} aria-hidden="true" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, background: 'var(--error)', color: '#fff',
            borderRadius: '9999px', fontSize: '.65rem', fontWeight: 700, minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: '110%', width: 320, maxHeight: 400, overflowY: 'auto', zIndex: 200, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>Notifications</strong>
            {unreadCount > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>}
          </div>
          {notifications.length === 0 && <p style={{ fontSize: '.875rem' }}>No notifications yet.</p>}
          {notifications.map((n) => (
            <div
              key={n._id}
              onClick={() => handleNotificationClick(n)}
              style={{
                padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                background: n.read ? 'transparent' : 'var(--orange-light)', marginBottom: 4,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{n.title}</div>
              <div style={{ fontSize: '.8125rem', color: 'var(--body)' }}>{n.message}</div>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 2 }}>{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
