import { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import api from '../utils/api';

export default function RequireAuth() {
  const [status, setStatus] = useState('loading'); // loading | authed | anon
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    api.get('/users/me')
      .then((r) => {
        if (cancelled) return;
        setUser(r.data);
        setStatus('authed');
      })
      .catch(() => {
        if (!cancelled) setStatus('anon');
      });
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') {
    return <div className="page"><p>Loading…</p></div>;
  }

  if (status === 'anon') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet context={{ user }} />;
}
