import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { GoogleLogin } from '@react-oauth/google';
import { authApi, getErrorMessage } from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [alert, setAlert] = useState(null);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [pendingUserId, setPendingUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef(null);
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!captchaToken) { setAlert({ type: 'alert-error', msg: 'Please complete the CAPTCHA' }); return; }
    setLoading(true);
    try {
      const res = await authApi.post('/login', { email, password, 'g-recaptcha-response': captchaToken });
      if (res.data.mfaRequired) {
        setRequiresMfa(true);
        setPendingUserId(res.data.userId);
        setAlert({ type: 'alert-success', msg: 'Enter your 6-digit authenticator code.' });
      } else {
        localStorage.setItem('accessToken', res.data.accessToken);
        navigate('/dashboard');
      }
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
      captchaRef.current?.reset();
      setCaptchaToken('');
    } finally { setLoading(false); }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const res = await authApi.post('/google', { credential: credentialResponse.credential });
      if (res.data.mfaRequired) {
        setRequiresMfa(true);
        setPendingUserId(res.data.userId);
        setAlert({ type: 'alert-success', msg: 'Enter your 6-digit authenticator code.' });
      } else {
        localStorage.setItem('accessToken', res.data.accessToken);
        navigate('/dashboard');
      }
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    } finally { setLoading(false); }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.post('/mfa/verify', { userId: pendingUserId, token: mfaToken });
      localStorage.setItem('accessToken', res.data.accessToken);
      navigate('/dashboard');
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page fade-up">
      <div className="auth-card">
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: 24 }}>
          <img src="/images/image copy 2.png" alt="SkillSwap" style={{ height: 48, width: 'auto' }} />
          <span style={{ color: '#1A1512', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>SkillSwap</span>
        </Link>

        <h2 style={{ marginBottom: 4 }}>Welcome back</h2>
        <p style={{ fontSize: '.875rem', marginBottom: 28 }}>
          {requiresMfa ? 'Enter your authenticator code to continue.' : 'Log in to your account.'}
        </p>

        {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

        {!requiresMfa ? (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="form-group">
              <label htmlFor="password" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Password
                <Link to="/forgot-password" style={{ color: 'var(--orange)', fontWeight: 500, fontSize: '.8125rem' }}>Forgot password?</Link>
              </label>
              <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••••••" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              <ReCAPTCHA sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY} onChange={setCaptchaToken} ref={captchaRef} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', color: 'var(--muted)', fontSize: '.8125rem' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              or
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setAlert({ type: 'alert-error', msg: 'Google sign-in failed' })}
              />
            </div>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.875rem', color: 'var(--body)' }}>
              No account?{' '}
              <Link to="/register" style={{ color: 'var(--orange)', fontWeight: 600 }}>Sign up free</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit}>
            <div className="form-group">
              <label htmlFor="mfa">6-digit code</label>
              <input type="text" id="mfa" value={mfaToken} onChange={e => setMfaToken(e.target.value)} required placeholder="000000" autoComplete="off" maxLength={6} style={{ letterSpacing: '.2em', textAlign: 'center', fontSize: '1.25rem' }} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
