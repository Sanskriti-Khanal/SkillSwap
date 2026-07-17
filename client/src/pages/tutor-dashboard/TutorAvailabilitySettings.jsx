import { useState, useEffect } from 'react';
import api, { getErrorMessage } from '../../utils/api';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TutorAvailabilitySettings() {
  const [days, setDays] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users/me').then((r) => setDays(r.data.availability_days || [])).catch(() => {});
  }, []);

  function toggleDay(day) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSave() {
    setLoading(true);
    setAlert(null);
    try {
      await api.patch('/users/profile', { availability_days: days });
      setAlert({ type: 'alert-success', msg: 'Availability updated.' });
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Calendar & Availability</h1>
      </div>
      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}
      <div className="card" style={{ maxWidth: 480 }}>
        <p style={{ marginBottom: 16 }}>Select the days you're generally available to teach.</p>
        {WEEKDAYS.map((day) => (
          <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontWeight: 500 }}>
            <input type="checkbox" checked={days.includes(day)} onChange={() => toggleDay(day)} style={{ accentColor: 'var(--orange)', width: 18, height: 18 }} />
            {day}
          </label>
        ))}
        <div className="divider" />
        <button className="btn btn-primary" disabled={loading} onClick={handleSave}>{loading ? 'Saving…' : 'Save availability'}</button>
      </div>
    </div>
  );
}
