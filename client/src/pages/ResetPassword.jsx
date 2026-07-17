import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { authApi, getErrorMessage } from '../utils/api';

const STRENGTH_COLORS = ['#DC2626', '#F97316', '#EAB308', '#84CC16', '#61B44E'];
const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [strengthScore, setStrengthScore] = useState(-1);
  const [strengthFeedback, setStrengthFeedback] = useState('');

  useEffect(() => {
    if (!password) { setStrengthScore(-1); setStrengthFeedback(''); return; }
    const t = setTimeout(async () => {
      try {
        const res = await authApi.post('/password-strength', { password });
        setStrengthScore(res.data.score);
        setStrengthFeedback(res.data.feedback?.warning || '');
      } catch (_) { }
    }, 300);
    return () => clearTimeout(t);
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setAlert({ type: 'alert-error', msg: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      await authApi.post('/password/reset-with-token', { token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2200);
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
    } finally { setLoading(false); }
  };

  const barWidth = strengthScore < 0 ? '0%' : `${(strengthScore + 1) * 20}%`;
  const barColor = STRENGTH_COLORS[strengthScore] ?? 'transparent';

  if (!token) {
    return (
      <div className="auth-page fade-up">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>Invalid reset link</h2>
          <p style={{ marginBottom: 24 }}>This link is missing its reset token. Please request a new one.</p>
          <Link to="/forgot-password" className="btn btn-primary" style={{ width: '100%', textAlign: 'center' }}>Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page fade-up">
      <div className="auth-card">
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: 24 }}>
          <img src="/images/image copy 2.png" alt="SkillSwap" style={{ height: 48, width: 'auto' }} />
          <span style={{ color: '#1A1512', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>SkillSwap</span>
        </Link>

        {done ? (
          <>
            <div className="icon-badge icon-badge-green icon-badge-lg" style={{ marginBottom: 20 }}>
              <CheckCircle2 aria-hidden="true" />
            </div>
            <h2 style={{ marginBottom: 8 }}>Password reset</h2>
            <p style={{ fontSize: '.875rem' }}>Redirecting you to log in…</p>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 4 }}>Set a new password</h2>
            <p style={{ fontSize: '.875rem', marginBottom: 28 }}>Choose a strong password you haven't used before.</p>

            {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="password">New password</label>
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

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm new password</label>
                <input type="password" id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Re-enter password" />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
