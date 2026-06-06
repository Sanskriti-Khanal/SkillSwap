import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api/auth';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // For refresh cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

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
