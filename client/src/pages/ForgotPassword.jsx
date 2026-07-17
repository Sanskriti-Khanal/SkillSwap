import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { Mail } from 'lucide-react';
import { authApi, getErrorMessage } from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const captchaRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!captchaToken) { setAlert({ type: 'alert-error', msg: 'Please complete the CAPTCHA' }); return; }
    setLoading(true);
    try {
      await authApi.post('/password/forgot', { email, 'g-recaptcha-response': captchaToken });
      setSent(true);
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
      captchaRef.current?.reset();
      setCaptchaToken('');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page fade-up">
      <div className="auth-card">
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: 24 }}>
          <img src="/images/image copy 2.png" alt="SkillSwap" style={{ height: 48, width: 'auto' }} />
          <span style={{ color: '#1A1512', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>SkillSwap</span>
        </Link>

        {sent ? (
          <>
            <div className="icon-badge icon-badge-orange icon-badge-lg" style={{ marginBottom: 20 }}>
              <Mail aria-hidden="true" />
            </div>
            <h2 style={{ marginBottom: 8 }}>Check your email</h2>
            <p style={{ fontSize: '.875rem', marginBottom: 28 }}>
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. The link expires in 30 minutes.
            </p>
            <Link to="/login" className="btn btn-secondary" style={{ width: '100%', textAlign: 'center' }}>Back to log in</Link>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 4 }}>Forgot your password?</h2>
            <p style={{ fontSize: '.875rem', marginBottom: 28 }}>
              Enter your email and we'll send you a link to reset it.
            </p>

            {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email address</label>
                <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                <ReCAPTCHA sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY} onChange={setCaptchaToken} ref={captchaRef} />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.875rem', color: 'var(--body)' }}>
                <Link to="/login" style={{ color: 'var(--orange)', fontWeight: 600 }}>Back to log in</Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
