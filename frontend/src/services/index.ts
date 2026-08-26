import api from "./apiClient";
import type {
  MovieDetail,
  MovieListItem,
  MovieSearchFilter,
  PagedResult,
  HomeFeed,
  ActorListItem,
  ActorDetail,
  AuthResult,
  ProfileData,
  ListSummary,
  ListDetail,
  ListFormPayload,
  Genre,
  MovieFormPayload,
  AdminUser,
  ActorFormPayload,
  DirectorListItem,
  DirectorDetail,
  DirectorFormPayload,
  WatchedMovie,
  ScreeningLogDay,
  Country,
  ListScope,
} from "@/types";

// ---------------- Movies ----------------
export const movieService = {
  search: async (
    filter: MovieSearchFilter,
  ): Promise<PagedResult<MovieListItem>> => {
    const { data } = await api.get("/movies", { params: filter });
    return data;
  },
  getById: async (id: string): Promise<MovieDetail> => {
    const { data } = await api.get(`/movies/${id}`);
    return data;
  },
  getHomeFeed: async (): Promise<HomeFeed> => {
    const { data } = await api.get("/movies/home-feed");
    return data;
  },
  toggleLike: async (id: string): Promise<boolean> => {
    const { data } = await api.post(`/movies/${id}/like`);
    return data;
  },
  toggleWatchlist: async (id: string): Promise<boolean> => {
    const { data } = await api.post(`/movies/${id}/watchlist`);
    return data;
  },
  toggleWatched: async (id: string): Promise<boolean> => {
    const { data } = await api.post(`/movies/${id}/watched`);
    return data;
  },
  upsertRating: async (id: string, value: number) =>
    (await api.post(`/movies/${id}/rating`, { value })).data,
  upsertReview: async (
    id: string,
    content: string,
    containsSpoiler = false,
  ) => {
    const { data } = await api.post(`/movies/${id}/reviews`, {
      content,
      containsSpoiler,
    });
    return data;
  },
  deleteReview: async (id: string) =>
    (await api.delete(`/movies/${id}/reviews`)).data,
  create: async (payload: MovieFormPayload) =>
    (await api.post("/movies", payload)).data,
  update: async (id: string, payload: MovieFormPayload) =>
    (await api.put(`/movies/${id}`, { id, ...payload })).data,
  remove: async (id: string) => (await api.delete(`/movies/${id}`)).data,
};

// ---------------- Actors ----------------
export const actorService = {
  search: async (
    search?: string,
    page = 1,
    pageSize = 20,
  ): Promise<PagedResult<ActorListItem>> => {
    const { data } = await api.get("/actors", {
      params: { search, page, pageSize },
    });
    return data;
  },
  getById: async (id: string): Promise<ActorDetail> => {
    const { data } = await api.get(`/actors/${id}`);
    return data;
  },
  toggleLike: async (id: string): Promise<boolean> => {
    const { data } = await api.post(`/actors/${id}/like`);
    return data;
  },
  create: async (payload: ActorFormPayload) =>
    (await api.post("/actors", payload)).data,
  update: async (id: string, payload: ActorFormPayload) =>
    (await api.put(`/actors/${id}`, { id, ...payload })).data,
  remove: async (id: string) => (await api.delete(`/actors/${id}`)).data,
};

// ---------------- Directors ----------------
export const directorService = {
  search: async (
    search?: string,
    page = 1,
    pageSize = 20,
  ): Promise<PagedResult<DirectorListItem>> => {
    const { data } = await api.get("/directors", {
      params: { search, page, pageSize },
    });
    return data;
  },
  getById: async (id: string): Promise<DirectorDetail> => {
    const { data } = await api.get(`/directors/${id}`);
    return data;
  },
  toggleLike: async (id: string): Promise<boolean> => {
    const { data } = await api.post(`/directors/${id}/like`);
    return data;
  },
  create: async (payload: DirectorFormPayload) =>
    (await api.post("/directors", payload)).data,
  update: async (id: string, payload: DirectorFormPayload) =>
    (await api.put(`/directors/${id}`, { id, ...payload })).data,
  remove: async (id: string) => (await api.delete(`/directors/${id}`)).data,
};

// ---------------- Auth ----------------
export const authService = {
  login: async (email: string, password: string): Promise<AuthResult> => {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
  },
  register: async (
    userName: string,
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    const { data } = await api.post("/auth/register", {
      userName,
      email,
      password,
    });
    return data;
  },
  refresh: async (): Promise<AuthResult> => {
    const { data } = await api.post("/auth/refresh");
    return data;
  },
  logout: async (): Promise<void> => {
    await api.post("/auth/logout");
  },
  requestPasswordReset: async (email: string): Promise<void> => {
    await api.post("/auth/forgot-password", { email });
  },
};

// ---------------- Profile ----------------
export const profileService = {
  getMyProfile: async (): Promise<ProfileData> => {
    const { data } = await api.get("/profile");
    return data;
  },
  updateProfile: async (payload: {
    userName: string;
    avatarUrl: string | null;
    fullName: string | null;
    country: string | null;
    birthDate: string | null;
    gender: string | null;
    biography: string | null;
  }) => (await api.put("/profile", payload)).data,
  setFavoriteSlot: async (slot: number, movieId: string) =>
    (
      await api.put(`/profile/favorites/${slot}`, JSON.stringify(movieId), {
        headers: { "Content-Type": "application/json" },
      })
    ).data,
  removeFavoriteSlot: async (slot: number) =>
    (await api.delete(`/profile/favorites/${slot}`)).data,
  setFavoriteActorSlot: async (slot: number, actorId: string) =>
    (
      await api.put(
        `/profile/favorite-actors/${slot}`,
        JSON.stringify(actorId),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    ).data,
  setFavoriteDirectorSlot: async (slot: number, directorId: string) =>
    (
      await api.put(
        `/profile/favorite-directors/${slot}`,
        JSON.stringify(directorId),
        {
          headers: { "Content-Type": "application/json" },
        },
      )
    ).data,
  uploadAvatar: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post("/profile/avatar", formData, {
      headers: { "Content-Type": undefined },
    });
    return data.avatarUrl;
  },
  removeFavoriteActorSlot: async (slot: number) =>
    (await api.delete(`/profile/favorite-actors/${slot}`)).data,
  removeFavoriteDirectorSlot: async (slot: number) =>
    (await api.delete(`/profile/favorite-directors/${slot}`)).data,
  updateSettings: async (language: string, theme: string) =>
    (await api.put("/profile/settings", { language, theme })).data,
  getWatchedFilms: async (params: {
    page: number;
    pageSize: number;
    sortBy?: string;
    hasRating?: boolean;
  }): Promise<PagedResult<WatchedMovie>> => {
    const { data } = await api.get("/profile/watched-films", { params });
    return data;
  },
  removeWatchedFilm: async (movieId: string) =>
    (await api.delete(`/profile/watched-films/${movieId}`)).data,
};

// ---------------- Genres ----------------
export const genreService = {
  getAll: async (): Promise<Genre[]> => {
    const { data } = await api.get("/genres");
    return data;
  },
};

// ---------------- Countries ----------------
export const countryService = {
  getAll: async (): Promise<Country[]> => {
    const { data } = await api.get("/countries");
    return data;
  },
};

// ---------------- Admin: Kullanıcı yönetimi ----------------
export const userService = {
  search: async (
    search?: string,
    page = 1,
    pageSize = 20,
  ): Promise<PagedResult<AdminUser>> => {
    const { data } = await api.get("/users", {
      params: { search, page, pageSize },
    });
    return data;
  },
  updateRole: async (id: string, role: "Admin" | "User") =>
    (await api.put(`/users/${id}/role`, { role })).data,
  toggleActive: async (id: string): Promise<boolean> =>
    (await api.put(`/users/${id}/toggle-active`)).data,
};

// ---------------- Lists (sistem/küratör listeleri) ----------------
export const listService = {
  getAll: async (scope: ListScope = "Official"): Promise<ListSummary[]> => {
    const { data } = await api.get("/lists", { params: { scope } });
    return data;
  },
  getById: async (id: string): Promise<ListDetail> => {
    const { data } = await api.get(`/lists/${id}`);
    return data;
  },
  create: async (payload: ListFormPayload) =>
    (await api.post("/lists", payload)).data,
  update: async (id: string, payload: ListFormPayload) =>
    (await api.put(`/lists/${id}`, payload)).data, // dikkat: artık body'ye id eklemiyoruz, backend UpdateListRequest'te Id yok
  remove: async (id: string) => (await api.delete(`/lists/${id}`)).data,
  toggleLike: async (id: string): Promise<boolean> => {
    const { data } = await api.post(`/lists/${id}/like`);
    return data;
  },
};

// ---------------- Screening Log (Seans Defteri) ----------------
export const screeningLogService = {
  getAll: async (): Promise<ScreeningLogDay[]> =>
    (await api.get("/screening-log")).data,
  log: async (
    movieId: string,
    watchedAtUtc: string,
    rating: number | null = null,
  ) =>
    (await api.post("/screening-log", { movieId, watchedAtUtc, rating })).data,
  update: async (
    entryId: string,
    watchedAtUtc: string,
    rating: number | null,
  ) =>
    (await api.put(`/screening-log/${entryId}`, { watchedAtUtc, rating })).data,
  remove: async (entryId: string) =>
    (await api.delete(`/screening-log/${entryId}`)).data,
};

export const uploadService = {
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post("/uploads/image", formData, {
      headers: { "Content-Type": undefined },
    });
    return data.url;
  },
};
