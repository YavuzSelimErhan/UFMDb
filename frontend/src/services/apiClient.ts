import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import i18n from "i18next";
import { getAccessToken, setAccessToken } from "./tokenStore";

const API_BASE = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : "/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // httpOnly refresh cookie'nin gidip gelebilmesi için şart
});

// ---------- Arayüz dilini backend'e ilet ----------
// Backend film başlığı/özet/tür adlarını bu başlığa göre Türkçe'ye düşürüyor (tr | en).
// Tarayıcının kendi Accept-Language değeri yerine her zaman arayüzde seçili dil gönderilir.
function currentApiLang(): "tr" | "en" {
  const lang = i18n.resolvedLanguage || i18n.language || "en";
  return lang.toLowerCase().startsWith("tr") ? "tr" : "en";
}

// ---------- Giden isteklerde: tam URL'e çevrilmiş upload adreslerini tekrar göreceli yap ----------
// Response interceptor /api/uploads/... yollarını tam URL'e çeviriyor. Backend yalnızca kendi
// ürettiği göreceli biçimi kabul ettiği için, bu alanlar geri gönderilirken öneki atıyoruz.
// Bilerek yalnızca aşağıdaki alanlar: diğer görsel alanlarının validator'ları göreceli adres kabul etmeyebilir.
const RELATIVE_UPLOAD_KEYS = new Set(["avatarUrl", "coverImageUrl"]);

function toRelativeUploadUrls(data: unknown, key?: string): unknown {
  if (!API_BASE) return data;
  if (typeof data === "string") {
    const prefix = `${API_BASE}/api/uploads/`;
    return key && RELATIVE_UPLOAD_KEYS.has(key) && data.startsWith(prefix)
      ? data.slice(API_BASE.length)
      : data;
  }
  if (Array.isArray(data)) return data.map((v) => toRelativeUploadUrls(v));
  if (
    data &&
    typeof data === "object" &&
    Object.getPrototypeOf(data) === Object.prototype
  ) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      result[k] = toRelativeUploadUrls(v, k);
    }
    return result;
  }
  return data;
}

// ---------- Request interceptor: JWT access token'ı ekle (bellekten) + dil başlığı ----------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.headers) {
    config.headers["Accept-Language"] = currentApiLang();
  }

  if (config.data instanceof FormData) {
    if (config.headers) delete config.headers["Content-Type"];
  } else if (config.data) {
    config.data = toRelativeUploadUrls(config.data);
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
  if (
    data &&
    typeof data === "object" &&
    Object.getPrototypeOf(data) === Object.prototype
  ) {
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
