import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getAccessToken, setAccessToken } from "./tokenStore";

const API_BASE = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : "/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // httpOnly refresh cookie'nin gidip gelebilmesi için şart
});

// ---------- Request interceptor: JWT access token'ı ekle (bellekten) ----------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
  }

  return config;
});

// ---------- Göreceli /api/uploads/... path'lerini tam URL'e çevir ----------
function fixImageUrls(data: unknown): unknown {
  if (!API_BASE) return data;
  if (typeof data === "string") {
    return data.startsWith("/api/uploads") ? `${API_BASE}${data}` : data;
  }
  if (Array.isArray(data)) return data.map(fixImageUrls);
  if (data && typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = fixImageUrls(value);
    }
    return result;
  }
  return data;
}

// ---------- 401 gelirse: sessizce refresh dene, başarılıysa isteği tekrarla ----------
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => {
    response.data = fixImageUrls(response.data);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // refresh endpoint'inin kendisi 401 dönerse döngüye girmeyelim, direkt çıkış yaptır
    if (originalRequest?.url?.includes("/auth/refresh")) {
      setAccessToken(null);
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              originalRequest.headers = originalRequest.headers ?? {};
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post("/auth/refresh");
        setAccessToken(data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        window.location.href = `${import.meta.env.BASE_URL}login`;
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
