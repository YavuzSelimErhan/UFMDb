export interface MovieListItem {
  id: string;
  title: string;
  releaseYear: number;
  posterUrl: string;
  averageRating: number;
  ratingCount: number;
  genres: string[];
  backdropUrl: string;
  overview: string;
  isInWatchlistByCurrentUser: boolean;
}

export interface MovieCast {
  actorId: string;
  fullName: string;
  photoUrl: string;
  characterName: string;
  order: number;
}

export interface MovieDirectorItem {
  id: string;
  fullName: string;
  photoUrl: string;
}

export interface MyReview {
  content: string;
  containsSpoiler: boolean;
}

export interface MovieDetail {
  id: string;
  title: string;
  originalTitle: string;
  overview: string;
  releaseYear: number;
  releaseDate: string;
  runtimeMinutes: number;
  posterUrl: string;
  backdropUrl: string;
  directors: MovieDirectorItem[];
  country: string;
  averageRating: number;
  ratingCount: number;
  likeCount: number;
  genres: string[];
  genreIds: string[];
  cast: MovieCast[];
  isLikedByCurrentUser: boolean;
  isInWatchlistByCurrentUser: boolean;
  isWatchedByCurrentUser: boolean;
  myReview: MyReview | null;
  myRating: number | null;
}

export interface CastMemberInput {
  actorId: string;
  characterName: string;
  order: number;
}

export interface MovieFormPayload {
  title: string;
  originalTitle: string;
  overview: string;
  releaseYear: number;
  releaseDate: string;
  runtimeMinutes: number;
  posterUrl: string;
  backdropUrl: string;
  directorIds: string[];
  country: string;
  genreIds: string[];
  cast: CastMemberInput[];
}

export interface AdminUser {
  id: string;
  userName: string;
  email: string;
  role: "Admin" | "User";
  isActive: boolean;
  createdAtUtc: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MovieSearchFilter {
  title?: string;
  genre?: string;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  actorName?: string;
  directorName?: string;
  minRating?: number;
  page?: number;
  pageSize?: number;
  sortBy?: "title" | "rating" | "year" | "popularity" | "newest";
  sortDirection?: "asc" | "desc";
}

export interface Genre {
  id: string;
  name: string;
  nameTr: string;
  movieCount: number;
}

export interface CuratedListDto {
  id: string;
  title: string;
  titleTr: string;
  movies: MovieListItem[];
}

export interface HomeFeed {
  featured: MovieListItem[];
  popular: MovieListItem[];
  topRated: MovieListItem[];
  trending: MovieListItem[];
  curatedLists: CuratedListDto[];
}

export interface ActorListItem {
  id: string;
  fullName: string;
  photoUrl: string;
  nationality: string;
}

export interface DirectorListItem {
  id: string;
  fullName: string;
  photoUrl: string;
  nationality: string;
}

export interface ActorFormPayload {
  fullName: string;
  birthDate: string | null;
  biography: string;
  photoUrl: string;
  nationality: string;
}

export interface ActorDetail {
  id: string;
  fullName: string;
  birthDate: string | null;
  biography: string;
  photoUrl: string;
  nationality: string;
  likeCount: number;
  isLikedByCurrentUser: boolean;
  filmography: MovieListItem[];
}

export interface DirectorFormPayload {
  fullName: string;
  birthDate: string | null;
  biography: string;
  photoUrl: string;
  nationality: string;
}

export interface DirectorDetail {
  id: string;
  fullName: string;
  birthDate: string | null;
  biography: string;
  photoUrl: string;
  nationality: string;
  likeCount: number;
  isLikedByCurrentUser: boolean;
  filmography: MovieListItem[];
}

export interface AuthResult {
  userId: string;
  userName: string;
  email: string;
  role: "Admin" | "User";
  accessToken: string;
}

export interface FavoriteSlot {
  slot: number;
  movie: MovieListItem | null;
}

export interface FavoriteActorSlot {
  slot: number;
  actor: ActorListItem | null;
}

export interface FavoriteDirectorSlot {
  slot: number;
  director: DirectorListItem | null;
}

export interface ReviewSummary {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string;
  content: string;
  containsSpoiler: boolean;
  createdAtUtc: string;
}

export interface ProfileData {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  preferredLanguage: string;
  preferredTheme: string;
  favoriteMovies: FavoriteSlot[];
  recentlyWatched: RecentlyWatchedItem[];
  likedMovies: MovieListItem[];
  watchlist: MovieListItem[];
  reviews: ReviewSummary[];
  favoriteActors: FavoriteActorSlot[];
  likedActors: ActorListItem[];
  favoriteDirectors: FavoriteDirectorSlot[];
  likedDirectors: DirectorListItem[];
  totalWatchedCount: number;
  averageGivenRating: number | null;
  ratingsCount: number;
  memberSinceUtc: string;
}
export interface ListSummary {
  id: string;
  title: string;
  titleTr: string;
  description: string;
  coverImageUrl: string;
  movieCount: number;
  coverPosters: string[];
}

export interface ListDetail {
  id: string;
  title: string;
  titleTr: string;
  description: string;
  coverImageUrl: string;
  movies: MovieListItem[];
}

export interface ListFormPayload {
  title: string;
  titleTr: string;
  description: string;
  coverImageUrl: string;
  displayOrder: number;
  movieIds: string[];
}

export interface WatchedMovie {
  id: string;
  movie: MovieListItem;
  watchedAtUtc: string;
  userRating: number | null;
}

export interface ScreeningLogEntry {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string;
  watchedAtUtc: string;
  screeningNumber: number;
  rating: number | null;
  reviewContent: string | null;
}

export interface ScreeningLogDay {
  date: string;
  entries: ScreeningLogEntry[];
}

export interface RecentlyWatchedItem {
  movie: MovieListItem;
  userRating: number | null;
}

export type ThemeMode = "dark" | "light";
export type LanguageCode = "tr" | "en";
