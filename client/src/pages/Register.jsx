import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { authApi, getErrorMessage } from '../utils/api';

const STRENGTH_COLORS = ['#DC2626', '#F97316', '#EAB308', '#84CC16', '#61B44E'];
const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [strengthScore, setStrengthScore] = useState(-1);
  const [strengthFeedback, setStrengthFeedback] = useState('');
  const captchaRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!password) { setStrengthScore(-1); setStrengthFeedback(''); return; }
    const t = setTimeout(async () => {
      try {
        const res = await authApi.post('/password-strength', { password });
        setStrengthScore(res.data.score);
        setStrengthFeedback(res.data.feedback?.warning || '');
      } catch (_) {}
    }, 300);
    return () => clearTimeout(t);
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!captchaToken) { setAlert({ type: 'alert-error', msg: 'Please complete the CAPTCHA' }); return; }
    setLoading(true);
    try {
      await authApi.post('/register', { email, password, 'h-captcha-response': captchaToken });
      setAlert({ type: 'alert-success', msg: 'Account created! Redirecting to login…' });
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
      captchaRef.current?.resetCaptcha();
      setCaptchaToken('');
    } finally { setLoading(false); }
  };

  const barWidth = strengthScore < 0 ? '0%' : `${(strengthScore + 1) * 20}%`;
  const barColor = STRENGTH_COLORS[strengthScore] ?? 'transparent';

  return (
    <div className="auth-page fade-up">
      <div className="auth-card">
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: 24 }}>
          <img src="/images/image copy 2.png" alt="SkillSwap" style={{ height: 48, width: 'auto' }} />
          <span style={{ color: '#1A1512', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>SkillSwap</span>
        </Link>

        <h2 style={{ marginBottom: 4 }}>Create your account</h2>
        <p style={{ fontSize: '.875rem', marginBottom: 28 }}>Join thousands of tutors and learners.</p>

        {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 12 characters" />
            {password && (
              <>
                <div className="strength-bar">
                  <div className="strength-fill" style={{ width: barWidth, background: barColor }} />
                </div>
                <p style={{ fontSize: '.75rem', marginTop: 4, color: barColor, fontWeight: 500 }}>
                  {STRENGTH_LABELS[strengthScore] ?? ''}
                  {strengthFeedback && ` — ${strengthFeedback}`}
                </p>
              </>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
            <HCaptcha sitekey="10000000-ffff-ffff-ffff-000000000001" onVerify={setCaptchaToken} ref={captchaRef} />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.875rem', color: 'var(--body)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--orange)', fontWeight: 600 }}>Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
