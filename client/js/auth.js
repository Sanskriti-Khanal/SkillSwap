const API_BASE_URL = 'http://localhost:3000/api/auth';

// Helper to show alerts
function showAlert(message, type) {
  const alertBox = document.getElementById('alertBox');
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.className = `alert ${type}`;
  alertBox.classList.remove('hidden');
  setTimeout(() => {
    alertBox.classList.add('hidden');
  }, 5000);
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// --- Registration Logic ---
const registerForm = document.getElementById('registerForm');
const passwordInput = document.getElementById('password');
const strengthBar = document.getElementById('strengthBar');
const strengthText = document.getElementById('strengthText');

if (passwordInput && strengthBar && strengthText) {
  const checkStrength = debounce(async (password) => {
    if (!password) {
      strengthBar.style.width = '0%';
      strengthText.textContent = '';
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/password-strength`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      
      const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
      const textLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
      
      const score = data.score; // 0 to 4
      strengthBar.style.width = `${(score + 1) * 20}%`;
      strengthBar.style.backgroundColor = colors[score];
      
      let feedback = textLabels[score];
      if (data.feedback.warning) {
        feedback += ` - ${data.feedback.warning}`;
      }
      strengthText.textContent = feedback;
      strengthText.style.color = colors[score];
    } catch (err) {
      console.error('Error fetching password strength', err);
    }
  }, 300);

  passwordInput.addEventListener('input', (e) => {
    checkStrength(e.target.value);
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        showAlert('Registration successful! You can now log in.', 'success');
        registerForm.reset();
        strengthBar.style.width = '0%';
        strengthText.textContent = '';
      } else {
        const msg = data.errors ? data.errors.map(err => err.msg).join(', ') : data.msg;
        showAlert(msg || 'Registration failed', 'error');
      }
    } catch (err) {
      showAlert('Server error', 'error');
    }
  });
}

// --- Login & MFA Logic ---
const loginForm = document.getElementById('loginForm');
const mfaForm = document.getElementById('mfaForm');
let pendingUserId = null;

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        if (data.mfaRequired) {
          // Hide login, show MFA
          loginForm.classList.add('hidden');
          mfaForm.classList.remove('hidden');
          pendingUserId = data.userId;
          showAlert('Please enter your authenticator code.', 'success');
        } else {
          // Logged in directly
          localStorage.setItem('accessToken', data.accessToken);
          showAlert('Logged in successfully!', 'success');
          // Redirect or change UI
        }
      } else {
        const msg = data.errors ? data.errors.map(err => err.msg).join(', ') : data.msg;
        showAlert(msg || 'Login failed', 'error');
      }
    } catch (err) {
      showAlert('Server error', 'error');
    }
  });
}

if (mfaForm) {
  mfaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('mfaToken').value;

    try {
      const res = await fetch(`${API_BASE_URL}/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId, token })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('accessToken', data.accessToken);
        showAlert('MFA Verified. Logged in successfully!', 'success');
        // Redirect or change UI
      } else {
        showAlert(data.msg || 'Invalid token', 'error');
      }
    } catch (err) {
      showAlert('Server error', 'error');
    }
  });
}
