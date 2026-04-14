import axios from 'axios';

// In development, CRA proxy handles /api -> localhost:5000
// In production, REACT_APP_API_URL points to Render backend
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
});

export default api;