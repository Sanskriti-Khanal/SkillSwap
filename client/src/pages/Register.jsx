import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import api, { getErrorMessage } from '../utils/api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [alert, setAlert] = useState(null);
  
  // Password strength state
  const [strengthScore, setStrengthScore] = useState(0);
  const [strengthFeedback, setStrengthFeedback] = useState('');
  
  const captchaRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!password) {
      setStrengthScore(-1);
      setStrengthFeedback('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/password-strength', { password });
        setStrengthScore(res.data.score);
        let feedback = res.data.feedback?.warning || '';
        setStrengthFeedback(feedback);
      } catch (err) {
        console.error('Failed to get strength', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!captchaToken) {
      setAlert({ type: 'alert-error', msg: 'Please complete the CAPTCHA' });
      return;
    }

    try {
      await api.post('/register', { email, password, 'h-captcha-response': captchaToken });
      setAlert({ type: 'alert-success', msg: 'Registration successful! Redirecting...' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setAlert({ type: 'alert-error', msg: getErrorMessage(err) });
      if (captchaRef.current) captchaRef.current.resetCaptcha();
      setCaptchaToken('');
    }
  };

  const getStrengthColor = () => {
    const colors = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#10B981'];
    return colors[strengthScore] || 'transparent';
  };

  const getStrengthText = () => {
    if (strengthScore === -1) return '';
    const textLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    let text = textLabels[strengthScore];
    if (strengthFeedback) text += ` - ${strengthFeedback}`;
    return text;
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 65px)' }}>
      {/* Left Form Side */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: '380px' }} className="animate-fade-in">
          <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>Create Account</h1>
          <p className="subtitle" style={{ marginBottom: '2rem' }}>Join SkillSwap to start sharing skills.</p>
          
          {alert && (
            <div className={`alert ${alert.type}`}>
              {alert.msg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
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
                required placeholder="Minimum 12 characters" 
              />
              <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginTop: '0.5rem', overflow: 'hidden' }}>
                <div style={{ 
                    height: '100%', 
                    width: strengthScore === -1 ? '0%' : `${(strengthScore + 1) * 20}%`,
                    backgroundColor: getStrengthColor(),
                    transition: 'all var(--transition-medium)'
                  }}></div>
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: getStrengthColor() }}>
                {getStrengthText()}
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
              <HCaptcha
                sitekey="10000000-ffff-ffff-ffff-000000000001"
                onVerify={setCaptchaToken}
                ref={captchaRef}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Create Account</button>
            
            <div className="text-center mt-4">
              <Link to="/login" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Already have an account? <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Log in</span>
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Right Visual Side */}
      <div style={{ flex: 1, backgroundColor: 'var(--surface-color)', display: 'none', '@media (min-width: 768px)': { display: 'flex' }, borderLeft: '1px solid var(--border-color)', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
        {/* Minimalist Abstract Graphic */}
        <div style={{ width: '100%', maxWidth: '400px', aspectRatio: '1', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '10%', left: '10%', width: '60%', height: '60%', border: '1px solid var(--border-color)', borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '40%', height: '40%', backgroundColor: 'var(--accent-color)', borderRadius: '8px' }}></div>
          <div style={{ position: 'absolute', top: '40%', left: '30%', width: '30%', height: '30%', border: '1px dashed var(--text-secondary)' }}></div>
        </div>
      </div>
    </div>
  );
}
