export default function Payments() {
  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: '600px' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2>Complete your booking</h2>
        <p className="subtitle" style={{ marginTop: '0.5rem' }}>Advanced React Patterns with Alex Chen</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed var(--border-color)' }}>
          <span>1 Hour Session</span>
          <span style={{ fontWeight: 600 }}>$120.00</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Platform Fee</span>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>$6.00</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem' }}>
          <span style={{ fontWeight: 600 }}>Total</span>
          <span style={{ fontWeight: 600 }}>$126.00</span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Payment Details</h3>
        <form>
          <div className="form-group">
            <label>Card Information</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '0.75rem 1rem', background: 'var(--bg-color)' }}>
              <input type="text" placeholder="Card number" style={{ border: 'none', padding: 0, width: '100%', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <span>MM/YY</span>
                <span>CVC</span>
              </div>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label>Name on card</label>
            <input type="text" placeholder="John Doe" />
          </div>
          <button type="button" className="btn btn-primary" style={{ width: '100%' }}>Pay $126.00</button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'var(--text-secondary)', borderRadius: '50%' }}></span>
          Secured by Stripe
        </div>
      </div>
    </div>
  );
}
