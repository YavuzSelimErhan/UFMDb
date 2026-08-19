import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : "/api",
  headers: { "Content-Type": "application/json" },
});

// ---------- Request interceptor: JWT access token'ı ekle ----------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("ufmdb_access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- Response interceptor: göreceli /api/uploads/... path'lerini tam URL'e çevir ----------
// Backend, resim URL'lerini (avatarUrl, posterUrl, photoUrl vb.) göreceli path olarak döner
// (örn. "/api/uploads/avatars/x.png"). Production'da frontend farklı bir domainde (GitHub Pages)
// barındığı için bu path'lerin başına backend'in tam adresini eklememiz gerekir.
function fixImageUrls(data: unknown): unknown {
  if (!API_BASE) return data; // local dev'de proxy zaten hallediyor, dokunma
  if (typeof data === "string") {
    return data.startsWith("/api/uploads") ? `${API_BASE}${data}` : data;
  }
  if (Array.isArray(data)) {
    return data.map(fixImageUrls);
  }
  if (data && typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = fixImageUrls(value);
    }
    return result;
  }
  return data;
}

// ---------- Response interceptor: 401 durumunda oturumu kapat ----------
// Not: Basitlik için burada refresh-token endpoint'i çağrılmıyor;
// prod ortamda /api/auth/refresh eklenip burada otomatik yenileme yapılabilir.
api.interceptors.response.use(
  (response) => {
    response.data = fixImageUrls(response.data);
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("ufmdb_access_token");
      localStorage.removeItem("ufmdb_refresh_token");
      localStorage.removeItem("ufmdb_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
