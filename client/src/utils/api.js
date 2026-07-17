import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

// Silent token refresh: access tokens expire after 15 minutes (server/src/routes/auth.js).
// On a 401, use the httpOnly refresh-token cookie to get a new access token and retry the
// original request once, instead of forcing the user to log in again mid-session.
// Concurrent 401s share a single in-flight refresh call rather than each firing their own.
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = authApi.post('/refresh')
      .then((res) => {
        localStorage.setItem('accessToken', res.data.accessToken);
        return res.data.accessToken;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

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
