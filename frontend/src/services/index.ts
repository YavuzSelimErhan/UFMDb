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
  Country,
  ListScope,
  MovieReview,
  ReviewSortBy,
  ReviewLikeResult,
  LikedReviewItem,
  UserSummaryDto,
  PublicProfileDto,
  PublicFullProfileDto,
  NotificationItem,
  MovieReactionResult,
  MovieFriendsActivity,
  FriendsActivity,
  ActivityFilter,
  ActivityFeedPage,
  ReactionType,
  ScreeningLogPage,
  ScreeningLogSummary,
  WatchedFilmsCounts,
  PagedLists,
  ListCreated,
  ListSort,
  ListMembership,
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
  /** Takip edilenlerin bu filmdeki hareketleri (giriş gerekir). */
  getFriendsActivity: async (id: string): Promise<MovieFriendsActivity> => {
    const { data } = await api.get(`/movies/${id}/friends-activity`);
    return data;
  },
  like: async (id: string): Promise<MovieReactionResult> => {
    const { data } = await api.post(`/movies/${id}/like`);
    return data;
  },
  dislike: async (id: string): Promise<MovieReactionResult> => {
    const { data } = await api.post(`/movies/${id}/dislike`);
    return data;
  },
  /** like/dislike endpoint'leri toggle çalışır; istenen tepkiye ulaşmak için gereken çağrıyı yapar. */
  setReaction: async (
    id: string,
    desired: ReactionType | null,
    current: ReactionType | null,
  ): Promise<MovieReactionResult | null> => {
    const target = desired ?? current;
    if (desired === current || target === null) return null;
    const toggle = (r: ReactionType) =>
      r === "Like" ? movieService.like(id) : movieService.dislike(id);
    // Kaldırmak için mevcut tepkinin, ayarlamak/geçmek için hedefin endpoint'ine basılır.
    let result = await toggle(target);
    // "current" bayatsa toggle ters etki eder; sonuç hedefe uymuyorsa bir kez düzelt.
    if (result.currentUserReaction !== desired) result = await toggle(target);
    return result;
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
  getReviews: async (
    id: string,
    page = 1,
    pageSize = 10,
    sortBy?: ReviewSortBy,
  ): Promise<PagedResult<MovieReview>> => {
    const { data } = await api.get(`/movies/${id}/reviews`, {
      params: { page, pageSize, sortBy },
    });
    return data;
  },
  toggleReviewLike: async (reviewId: string): Promise<ReviewLikeResult> => {
    const { data } = await api.post(`/movies/reviews/${reviewId}/like`);
    return data;
  },
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
  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await api.post("/auth/reset-password", { token, newPassword });
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
  deleteAccount: async (password: string) =>
    (await api.delete("/profile", { data: { password } })).data,
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
  getLikedReviews: async (): Promise<LikedReviewItem[]> => {
    const { data } = await api.get("/profile/liked-reviews");
    return data;
  },
  getWatchedFilmCounts: () =>
    api
      .get<WatchedFilmsCounts>("/profile/watched-films/counts")
      .then((r) => r.data),
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

// ---------------- Lists ----------------
export const listService = {
  getAll: async (
    params: {
      scope?: ListScope;
      sort?: ListSort;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PagedLists> => {
    const { data } = await api.get("/lists", { params });
    return data;
  },
  getById: async (id: string): Promise<ListDetail> => {
    const { data } = await api.get(`/lists/${id}`);
    return data;
  },
  getBySlug: async (slug: string): Promise<ListDetail> => {
    const { data } = await api.get(`/lists/by-slug/${slug}`);
    return data;
  },
  create: async (payload: ListFormPayload): Promise<ListCreated> =>
    (await api.post("/lists", payload)).data,
  // isOfficial update'te gönderilmez; fazladan alan zararsız ama gereksiz.
  update: async (
    id: string,
    payload: Omit<ListFormPayload, "isOfficial">,
  ): Promise<void> => {
    await api.put(`/lists/${id}`, payload);
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/lists/${id}`);
  },
  toggleLike: async (id: string): Promise<boolean> => {
    const { data } = await api.post(`/lists/${id}/like`);
    return data;
  },
  addItem: async (
    listId: string,
    movieId: string,
    note?: string | null,
    noteTr?: string | null,
  ): Promise<void> => {
    await api.post(`/lists/${listId}/items`, { movieId, note, noteTr });
  },
  removeItem: async (listId: string, movieId: string): Promise<void> => {
    await api.delete(`/lists/${listId}/items/${movieId}`);
  },
  /** "Listeye ekle" menüsü: kullanıcının tüm listeleri + bu filmi içerip içermediği. */
  getMyListsForMovie: async (movieId: string): Promise<ListMembership[]> => {
    const { data } = await api.get(`/lists/for-movie/${movieId}`);
    return data;
  },
};

// ---------------- Screening Log (Seans Defteri) ----------------
export const screeningLogService = {
  getPage: async (params: {
    cursor?: string;
    pageSize?: number;
    reaction?: ReactionType;
    search?: string;
  }): Promise<ScreeningLogPage> =>
    (await api.get("/screening-log", { params })).data,
  getSummary: async (): Promise<ScreeningLogSummary> =>
    (await api.get("/screening-log/summary")).data,
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

export { uploadService } from "./uploadService";

// ---------------- Follows ----------------
export const followService = {
  searchUsers: async (
    search?: string,
    page = 1,
    pageSize = 20,
  ): Promise<PagedResult<UserSummaryDto>> => {
    const { data } = await api.get("/follows/users/search", {
      params: { search, page, pageSize },
    });
    return data;
  },
  getProfileByUserName: async (userName: string): Promise<PublicProfileDto> => {
    const { data } = await api.get(`/users/by-username/${userName}`);
    return data;
  },
  toggleFollow: async (targetUserId: string): Promise<boolean> => {
    const { data } = await api.post(`/follows/users/${targetUserId}/toggle`);
    return data;
  },
  getFollowers: async (userId: string): Promise<UserSummaryDto[]> => {
    const { data } = await api.get(`/follows/users/${userId}/followers`);
    return data;
  },
  getFollowing: async (userId: string): Promise<UserSummaryDto[]> => {
    const { data } = await api.get(`/follows/users/${userId}/following`);
    return data;
  },
  getFullProfileByUserName: async (
    userName: string,
  ): Promise<PublicFullProfileDto> => {
    const { data } = await api.get(
      `/users/by-username/${userName}/full-profile`,
    );
    return data;
  },
  getUserLists: async (
    userId: string,
    page = 1,
    pageSize = 24,
  ): Promise<PagedLists> => {
    const { data } = await api.get(`/users/${userId}/lists`, {
      params: { page, pageSize },
    });
    return data;
  },
  getWatchedFilms: async (
    userId: string,
    params: {
      page: number;
      pageSize: number;
      sortBy?: string;
      hasRating?: boolean;
    },
  ): Promise<PagedResult<WatchedMovie>> => {
    const { data } = await api.get(`/users/${userId}/watched-films`, {
      params,
    });
    return data;
  },
  getWatchedFilmCounts: (userId: string) =>
    api
      .get<WatchedFilmsCounts>(`/users/${userId}/watched-films/counts`)
      .then((r) => r.data),
};

// ---------------- Notifications ----------------
export const notificationService = {
  getAll: async (page = 1, pageSize = 20): Promise<NotificationItem[]> => {
    const { data } = await api.get("/notifications", {
      params: { page, pageSize },
    });
    return data;
  },
  getUnreadCount: async (): Promise<number> => {
    const { data } = await api.get("/notifications/unread-count");
    return data;
  },
  markRead: async (id: string): Promise<void> => {
    await api.post(`/notifications/${id}/read`);
  },
  markAllRead: async (): Promise<void> => {
    await api.post("/notifications/read-all");
  },
};

// ---------------- Feed ----------------
export const feedService = {
  getFriendsActivity: async (): Promise<FriendsActivity> => {
    const { data } = await api.get("/feed/friends");
    return data;
  },
  getActivity: async (params: {
    type: ActivityFilter;
    before?: string;
    pageSize: number;
  }): Promise<ActivityFeedPage> => {
    const { data } = await api.get("/feed/activity", { params });
    return data;
  },
};
