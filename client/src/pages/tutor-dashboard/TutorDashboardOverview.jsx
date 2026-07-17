import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarDays, Star } from 'lucide-react';
import api from '../../utils/api';

export default function TutorDashboardOverview() {
  const { user } = useOutletContext();
  const [reviewCount, setReviewCount] = useState(null);
  const [bookingCount, setBookingCount] = useState(null);

  useEffect(() => {
    api.get('/reviews/tutor/me').then((r) => setReviewCount(r.data.length)).catch(() => {});
    api.get('/bookings').then((r) => setBookingCount(r.data.length)).catch(() => {});
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Tutor Dashboard</h1>
      <p style={{ marginBottom: 24 }}>Welcome back, {user?.email?.split('@')[0]}.</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><CalendarDays aria-hidden="true" /></div>
          <div className="stat-label">Total bookings</div>
          <div className="stat-value">{bookingCount ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Star aria-hidden="true" /></div>
          <div className="stat-label">Reviews received</div>
          <div className="stat-value">{reviewCount ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
