export default function Profile() {
  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h2>Profile Settings</h2>
        <p className="subtitle" style={{ textAlign: 'left', marginTop: '0.25rem' }}>Manage your account and public profile.</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', alignItems: 'center' }}>
        <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 600 }}>
          US
        </div>
        <div>
          <button className="btn btn-secondary" style={{ marginRight: '1rem' }}>Upload New Picture</button>
          <button className="btn" style={{ color: 'var(--error)' }}>Remove</button>
        </div>
      </div>

      <div className="card">
        <form>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <label>First Name</label>
              <input type="text" defaultValue="User" />
            </div>
            <div>
              <label>Last Name</label>
              <input type="text" defaultValue="Smith" />
            </div>
          </div>
          <div className="form-group">
            <label>Headline</label>
            <input type="text" defaultValue="Senior Software Engineer at TechCorp" />
          </div>
          <div className="form-group">
            <label>Bio</label>
            <textarea 
              rows={4} 
              defaultValue="I love teaching React, Next.js, and modern web development."
              style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', fontFamily: 'var(--font-sans)', outline: 'none' }}
            ></textarea>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
