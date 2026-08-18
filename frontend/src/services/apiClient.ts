import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// ---------- Request interceptor: JWT access token'ı ekle ----------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('ufmdb_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- Response interceptor: 401 durumunda oturumu kapat ----------
// Not: Basitlik için burada refresh-token endpoint'i çağrılmıyor;
// prod ortamda /api/auth/refresh eklenip burada otomatik yenileme yapılabilir.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ufmdb_access_token');
      localStorage.removeItem('ufmdb_refresh_token');
      localStorage.removeItem('ufmdb_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
