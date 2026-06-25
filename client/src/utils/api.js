import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Required for cookie-based CSRF token and refresh token
  headers: {
    'Content-Type': 'application/json'
  }
});

// Separate instance for /api/auth/* routes (login, register, MFA, password-strength)
export const authApi = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// CSRF double-submit: read the csrf-token cookie set by the server and echo it
// in the X-CSRF-Token header on every state-changing request.
// A cross-origin attacker cannot read this cookie (same-origin policy), so they
// cannot forge the header even if the browser auto-sends the cookie.
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function csrfInterceptor(config) {
  const method = config.method?.toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = getCsrfToken();
    if (token) {
      config.headers['x-csrf-token'] = token;
    }
  }
  return config;
}

// Attach the stored JWT access token to every request on the main api instance.
// The auth middleware accepts it as "Authorization: Bearer <token>".
function authInterceptor(config) {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}

api.interceptors.request.use(authInterceptor);
api.interceptors.request.use(csrfInterceptor);
authApi.interceptors.request.use(csrfInterceptor);

// Helper for error messages
export const getErrorMessage = (error) => {
  if (error.response) {
    if (error.response.status === 429) {
      return 'Too many attempts. Please try again later.';
    }
    const data = error.response.data;
    if (data.errors && data.errors.length > 0) {
      return data.errors.map(err => err.msg).join(', ');
    }
    return data.msg || 'An error occurred';
  }
  return 'Server error';
};

export default api;
