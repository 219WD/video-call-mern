// src/services/api.js → VERSIÓN CORRECTA 2025
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL; // ¡OBLIGATORIO!

if (!API_URL) {
  console.error('❌ REACT_APP_API_URL no está definido en .env');
}

const api = axios.create({
  baseURL: API_URL, // ← ESTO ES LO QUE FALTABA
  withCredentials: true, // ← Importante para cookies si usas sessions (opcional)
});

// Interceptor para token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para errores 401 → logout automático
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;