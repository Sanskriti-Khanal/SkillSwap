export default function Listings() {
  const mockListings = [
    { id: 1, title: 'Senior UX Design Mentorship', author: 'Sarah Jenkins', price: '$80/hr', tag: 'Design' },
    { id: 2, title: 'Fullstack Next.js Architecture', author: 'Markus Doe', price: '$120/hr', tag: 'Engineering' },
    { id: 3, title: 'Startup Pitch Deck Review', author: 'Elena Rose', price: '$90/hr', tag: 'Business' },
    { id: 4, title: 'Advanced Motion Graphics in AE', author: 'Chris T.', price: '$75/hr', tag: 'Video' },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>Marketplace</h2>
          <p className="subtitle" style={{ textAlign: 'left', marginBottom: 0, marginTop: '0.25rem' }}>Find the perfect mentor to upskill.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input type="text" placeholder="Search skills..." style={{ width: '250px' }} />
          <button className="btn btn-secondary">Filter</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {mockListings.map(listing => (
          <div key={listing.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer' }}>
            <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--surface-color)', borderRadius: '4px' }}></div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{listing.tag}</span>
                <span style={{ fontWeight: 600 }}>{listing.price}</span>
              </div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{listing.title}</h3>
              <p style={{ fontSize: '0.875rem' }}>by {listing.author}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
