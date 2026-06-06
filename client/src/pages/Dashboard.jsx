export default function Dashboard() {
  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Dashboard</h2>
        <button className="btn btn-primary">Create Listing</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Active Listings</p>
          <p style={{ fontSize: '2rem', fontWeight: 600 }}>3</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Upcoming Sessions</p>
          <p style={{ fontSize: '2rem', fontWeight: 600 }}>5</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total Earnings</p>
          <p style={{ fontSize: '2rem', fontWeight: 600 }}>$1,240</p>
        </div>
      </div>

      <h3>Recent Bookings</h3>
      <div className="card mt-4" style={{ padding: 0, overflow: 'hidden' }}>
        {[1, 2, 3].map((_, i) => (
          <div key={i} style={{ padding: '1.5rem', borderBottom: i !== 2 ? '1px solid var(--border-color)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}></div>
              <div>
                <p style={{ fontWeight: 500 }}>Advanced React Patterns</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>with Alex Chen • Today, 2:00 PM</p>
              </div>
            </div>
            <span style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--surface-color)', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 500 }}>Upcoming</span>
          </div>
        ))}
      </div>
    </div>
  );
}
