export default function Bookings() {
  const timeline = [
    { id: 1, date: 'Today, 2:00 PM', title: 'Advanced React Patterns', person: 'Alex Chen', status: 'Upcoming', statusColor: 'var(--text-primary)' },
    { id: 2, date: 'Yesterday, 10:00 AM', title: 'Portfolio Review', person: 'Maria Garcia', status: 'Completed', statusColor: 'var(--success)' },
    { id: 3, date: 'May 14, 3:30 PM', title: 'Figma Mastery', person: 'David Kim', status: 'Completed', statusColor: 'var(--success)' },
    { id: 4, date: 'May 10, 1:00 PM', title: 'Node.js Architecture', person: 'Sarah Jenkins', status: 'Cancelled', statusColor: 'var(--error)' }
  ];

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <h2>Bookings History</h2>
      </div>

      <div style={{ position: 'relative', paddingLeft: '1rem' }}>
        <div style={{ position: 'absolute', left: '15px', top: '10px', bottom: '10px', width: '1px', backgroundColor: 'var(--border-color)' }}></div>
        
        {timeline.map((item, index) => (
          <div key={item.id} style={{ position: 'relative', paddingLeft: '2.5rem', marginBottom: index === timeline.length - 1 ? 0 : '2.5rem' }}>
            <div style={{ position: 'absolute', left: '-5px', top: '4px', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: 'var(--bg-color)', border: `2px solid ${item.statusColor}` }}></div>
            
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{item.date}</p>
            <div className="card" style={{ padding: '1.25rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{item.title}</h3>
                  <p style={{ fontSize: '0.875rem' }}>with {item.person}</p>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: item.statusColor }}>{item.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
