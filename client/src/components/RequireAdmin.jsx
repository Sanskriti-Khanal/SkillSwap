import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import api from '../utils/api';

export default function RequireAdmin() {
  const [status, setStatus] = useState('loading'); // loading | admin | denied
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/users/me')
      .then((r) => {
        if (cancelled) return;
        setUser(r.data);
        setStatus(r.data.role === 'admin' ? 'admin' : 'denied');
      })
      .catch(() => { if (!cancelled) setStatus('denied'); });
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') {
    return <div className="page"><p>Loading…</p></div>;
  }

  if (status === 'denied') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet context={{ user }} />;
}
