import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import api, { getErrorMessage } from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [alert, setAlert] = useState(null);
  
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [pendingUserId, setPendingUserId] = useState(null);

  const captchaRef = useRef(null);
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!captchaToken) {
      setAlert({ type: 'alert-error', msg: 'Please complete the CAPTCHA' });
      return;
    }

    try {
      const res = await api.post('/login', { email, password, 'h-captcha-response': captchaToken });
      if (res.data.mfaRequired) {
        setRequiresMfa(true);
        setPendingUserId(res.data.userId);
        setAlert({ type: 'alert-success', msg: 'Please enter your authenticator code.' });
      } else {
        localStorage.setItem('accessToken', res.data.accessToken);
        setAlert({ type: 'alert-success', msg: 'Logged in successfully!' });
        setTimeout(() => navigate('/dashboard'), 1000);
      }
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
      if (captchaRef.current) captchaRef.current.resetCaptcha();
      setCaptchaToken('');
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/mfa/verify', { userId: pendingUserId, token: mfaToken });
      localStorage.setItem('accessToken', res.data.accessToken);
      setAlert({ type: 'alert-success', msg: 'MFA Verified. Logged in successfully!' });
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 65px)' }}>
      {/* Left Visual Side (Swapped for Login) */}
      <div style={{ flex: 1, backgroundColor: 'var(--surface-color)', display: 'none', '@media (min-width: 768px)': { display: 'flex' }, borderRight: '1px solid var(--border-color)', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '100%', maxWidth: '400px', aspectRatio: '1', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '20%', right: '20%', width: '50%', height: '50%', border: '1px solid var(--border-color)' }}></div>
          <div style={{ position: 'absolute', bottom: '20%', left: '20%', width: '40%', height: '40%', backgroundColor: 'var(--accent-color)', borderRadius: '50%' }}></div>
        </div>
      </div>

      {/* Right Form Side */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: '380px' }} className="animate-fade-in">
          <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>Welcome back</h1>
          <p className="subtitle" style={{ marginBottom: '2rem' }}>Log in to access your dashboard.</p>
          
          {alert && (
            <div className={`alert ${alert.type}`}>
              {alert.msg}
            </div>
          )}

          {!requiresMfa ? (
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email address</label>
                <input 
                  type="email" id="email" 
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required placeholder="you@example.com" 
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input 
                  type="password" id="password" 
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required placeholder="••••••••••••" 
                />
              </div>

              <div className="form-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                <HCaptcha
                  sitekey="10000000-ffff-ffff-ffff-000000000001"
                  onVerify={setCaptchaToken}
                  ref={captchaRef}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Log in</button>
              
              <div className="text-center mt-4">
                <Link to="/register" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Don't have an account? <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Sign up</span>
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit}>
              <div className="form-group">
                <label htmlFor="mfaToken">Authenticator Code</label>
                <input 
                  type="text" id="mfaToken" 
                  value={mfaToken} onChange={(e) => setMfaToken(e.target.value)}
                  required placeholder="6-digit code" autoComplete="off" 
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Verify</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
