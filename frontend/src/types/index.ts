export type ReactionType = "Like" | "Dislike";

export type WatchedFilmsCounts = {
  all: number;
  rated: number;
  unrated: number;
  thisYear?: number | null;
};

export interface MovieReactionResult {
  currentUserReaction: ReactionType | null;
  likeCount: number;
  dislikeCount: number;
}

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
  isLikedByCurrentUser: boolean;
  isWatchedByCurrentUser: boolean;
  releaseDate: string;
  currentUserReaction?: ReactionType | null;
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

export interface MovieReview {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  content: string;
  containsSpoiler: boolean;
  likeCount: number;
  isLikedByCurrentUser: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface ReviewLikeResult {
  isLiked: boolean;
  likeCount: number;
}

export type ReviewSortBy = "newest" | "oldest" | "popular";

// ---------- Film detayına eklenen TMDB verileri ----------

export interface MovieVideo {
  /** YouTube anahtarı (URL değil): https://www.youtube.com/watch?v={key} */
  key: string;
  site: string;
  /** "Trailer" | "Teaser" */
  type: string;
  name: string;
  /** ISO 639-1 ("en", "tr"); boşsa dil belirtilmemiş */
  language: string;
  isOfficial: boolean;
}

export type MovieImageType = "Poster" | "Backdrop" | "Logo";

export interface MovieImage {
  type: MovieImageType | string;
  /** TMDB yolu ("/abc.jpg"); tam URL: https://image.tmdb.org/t/p/{size}{filePath} */
  filePath: string;
  language: string;
  width: number;
  height: number;
}

export interface Keyword {
  id: string;
  name: string;
}

export interface ProductionCompany {
  id: string;
  name: string;
  /** TMDB yolu; boş olabilir */
  logoPath: string;
  originCountry: string;
}

export interface MovieCountry {
  isoCode: string;
  name: string;
}

export interface CollectionMovie {
  id: string;
  title: string;
  releaseYear: number;
  posterUrl: string;
}

export interface MovieCollection {
  id: string;
  name: string;
  posterUrl: string;
  backdropUrl: string;
  /** Serideki DİĞER filmler (geçerli film hariç) */
  movies: CollectionMovie[];
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
  dislikeCount: number;
  genres: string[];
  genreIds: string[];
  cast: MovieCast[];
  isLikedByCurrentUser: boolean;
  isInWatchlistByCurrentUser: boolean;
  isWatchedByCurrentUser: boolean;
  myReview: MyReview | null;
  myRating: number | null;
  currentUserReaction: ReactionType | null;

  // --- TMDB'den gelen ek alanlar ---
  tagline: string;
  /** Hızlı erişim için ana fragman anahtarı; tam liste `videos` içinde */
  trailerKey: string;
  /** Yaş sınırı (örn. "PG-13", "13+") ve hangi ülkeye ait olduğu ("TR" | "US") */
  certification: string;
  certificationCountry: string;
  imdbId: string | null;
  homepage: string;
  /** ISO 639-1 (örn. "en", "ko") */
  originalLanguage: string;
  /** USD; 0 = bilinmiyor */
  budget: number;
  /** USD; 0 = bilinmiyor */
  revenue: number;
  /** TMDB'nin ham durumu: "Released", "Post Production" vb. */
  tmdbStatus: string;
  countries: MovieCountry[];
  keywords: Keyword[];
  companies: ProductionCompany[];
  videos: MovieVideo[];
  images: MovieImage[];
  collection: MovieCollection | null;
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
  /**
   * Backend bu alanı her güncellemede yazıyor; gönderilmezse 0 olarak kaydedilir.
   * Admin formu mevcut değeri her zaman geri göndermeli.
   */
  seedRating?: number;
  // Backend'de null = "dokunma", "" = "temizle"
  titleTr?: string | null;
  overviewTr?: string | null;
  tagline?: string | null;
  taglineTr?: string | null;
  trailerKey?: string | null;
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
  country?: string;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  actorName?: string;
  directorName?: string;
  minRating?: number;
  keyword?: string;
  collectionId?: string;
  page?: number;
  pageSize?: number;
  sortBy?:
    | "title"
    | "rating"
    | "year"
    | "popularity"
    | "newest"
    | "releaseDate"
    | "votes"
    | "random";
  sortDirection?: "asc" | "desc";
  releaseDateFrom?: string;
  releaseDateTo?: string;
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

export interface LikedReviewItem {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  content: string;
  containsSpoiler: boolean;
  likeCount: number;
  createdAtUtc: string;
}

/** Seans Defteri gizliliği; backend DiaryVisibility enum adlarıyla birebir aynı. */
export type DiaryVisibility = "Public" | "Followers" | "Private";

export interface ProfileData {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  preferredLanguage: string;
  preferredTheme: string;
  diaryVisibility: DiaryVisibility;
  fullName: string | null;
  country: string | null;
  birthDate: string | null;
  gender: "NotSpecified" | "Male" | "Female";
  biography: string | null;
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
  watchedCounts: WatchedFilmsCounts;
  averageGivenRating: number | null;
  ratingsCount: number;
  memberSinceUtc: string;
  followerCount: number;
  followingCount: number;
  coverMovieId: string | null;
  coverBackdropUrl: string | null;
}

export type ListVisibility = "Public" | "Unlisted" | "Private";
export type ListStatus = "Published" | "Draft" | "Archived";
export type ListSort = "Default" | "Newest" | "Popular";
// "User" sadece backend'in /users/{id}/lists endpoint'i için; sayfalarda "Official" | "Community" | "Mine" | "Liked" kullanılır.
export type ListScope =
  | "All"
  | "Official"
  | "Community"
  | "Mine"
  | "Liked"
  | "User";

export interface ListSummary {
  id: string;
  slug: string;
  title: string;
  titleTr: string;
  description: string;
  descriptionTr: string;
  coverImageUrl: string;
  movieCount: number;
  coverPosters: string[];
  isRanked: boolean;
  visibility: ListVisibility;
  status: ListStatus;
  isOfficial: boolean;
  createdByUserId: string;
  createdByUserName: string;
  likeCount: number;
  viewCount: number;
  isLikedByCurrentUser: boolean;
  publishedAt: string | null;
}

export interface ListItem {
  order: number;
  note: string | null;
  noteTr: string | null;
  movie: MovieListItem;
}

export interface ListDetail {
  id: string;
  slug: string;
  title: string;
  titleTr: string;
  description: string;
  descriptionTr: string;
  coverImageUrl: string;
  isRanked: boolean;
  visibility: ListVisibility;
  status: ListStatus;
  items: ListItem[];
  isOfficial: boolean;
  createdByUserId: string;
  createdByUserName: string;
  likeCount: number;
  viewCount: number;
  isLikedByCurrentUser: boolean;
  canEdit: boolean;
  publishedAt: string | null;
  displayOrder: number;
}

// Backend listelerde totalPages dönmüyor; gerekirse Math.ceil(totalCount / pageSize).
export interface PagedLists {
  items: ListSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ListCreated {
  id: string;
  slug: string;
}

export interface ListItemInput {
  movieId: string;
  note?: string | null;
  noteTr?: string | null;
}

export interface ListFormPayload {
  title: string;
  titleTr: string;
  description: string;
  descriptionTr: string;
  coverImageUrl: string;
  displayOrder: number;
  isRanked: boolean;
  visibility: ListVisibility;
  status: ListStatus;
  items: ListItemInput[];
  isOfficial: boolean; // sadece create'te kullanılır; admin değilse backend yok sayar
}

export interface ListMembership {
  id: string;
  slug: string;
  title: string;
  titleTr: string;
  itemCount: number;
  visibility: ListVisibility;
  status: ListStatus;
  containsMovie: boolean;
}

export interface WatchedMovie {
  movieId: string;
  movie: MovieListItem;
  watchedAtUtc: string | null;
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
  reaction?: ReactionType | null;
  reviewContainsSpoiler?: boolean;
}

export interface ScreeningLogDay {
  date: string;
  entries: ScreeningLogEntry[];
}

export interface ScreeningLogPage {
  days: ScreeningLogDay[];
  nextCursor: string | null;
}

export interface ScreeningLogSummary {
  totalScreenings: number;
  uniqueFilms: number;
  ratedScreenings: number;
  averageRating: number | null;
  likedFilms: number;
  notForMeFilms: number;
}

/** Seans Defteri sorgu parametreleri (kendi defterin ve başkasınınki için ortak). */
export interface ScreeningLogParams {
  cursor?: string;
  pageSize?: number;
  reaction?: ReactionType;
  search?: string;
}

export interface RecentlyWatchedItem {
  movie: MovieListItem;
  userRating: number | null;
}

export interface Country {
  id: string;
  name: string;
  nameTr: string;
  movieCount: number;
}

export interface UserSummaryDto {
  id: string;
  userName: string;
  fullName: string | null;
  avatarUrl: string | null;
  isFollowedByCurrentUser: boolean;
}

export type UserGender = "NotSpecified" | "Male" | "Female";

export interface PublicProfileDto {
  id: string;
  userName: string;
  fullName: string | null;
  avatarUrl: string | null;
  biography: string | null;
  country: string | null;
  gender: UserGender;
  followerCount: number;
  followingCount: number;
  isFollowedByCurrentUser: boolean;
  isCurrentUser: boolean;
  diaryVisibility: DiaryVisibility;
  /** Bakan kişi bu kullanıcının Seans Defteri'ni görebilir mi (sahibi / herkese açık / takipçi). */
  canViewDiary: boolean;
}

export interface PublicFullProfileDto {
  id: string;
  userName: string;
  fullName: string | null;
  avatarUrl: string | null;
  biography: string | null;
  country: string | null;
  birthDate: string | null;
  gender: UserGender;
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
  watchedCounts: WatchedFilmsCounts;
  averageGivenRating: number | null;
  ratingsCount: number;
  memberSinceUtc: string;
  followerCount: number;
  followingCount: number;
  listsCount: number;
  isFollowedByCurrentUser: boolean;
  isCurrentUser: boolean;
  diaryVisibility: DiaryVisibility;
  /** false ise recentlyWatched backend'de boşaltılır; defter sekmesi kilitli gösterilir. */
  canViewDiary: boolean;
  coverMovieId: string | null;
  coverBackdropUrl: string | null;
}

export interface CompatibilityResult {
  /** 0–100; ortak film sayısı eşiğin altındaysa null */
  score: number | null;
  /** İki kullanıcının da puanladığı film sayısı */
  commonCount: number;
  /** Skorun hesaplanması için gereken minimum ortak film sayısı */
  minRequired: number;
}

export interface CompatibilityFilm {
  movieId: string;
  title: string;
  releaseYear: number;
  posterUrl: string;
  myRating: number;
  theirRating: number;
  /** |myRating - theirRating|, yıldız cinsinden */
  difference: number;
}

export interface CompatibilityFilms {
  agreements: CompatibilityFilm[];
  disagreements: CompatibilityFilm[];
  /** Listeler kırpılmış olabilir; bunlar kırpılmamış gerçek toplamlar. */
  agreementCount?: number;
  disagreementCount?: number;
  /** Tüm ortak filmlerde ortalama puan farkı (yıldız); ortak film yoksa null */
  averageDifference: number | null;
}

export type ThemeMode = "dark" | "light";
export type LanguageCode = "tr" | "en";

export type NotificationType =
  | "Follow"
  | "ReviewLike"
  | "ListLike"
  | "ListCreated";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actorUserId: string | null;
  actorUserName: string | null;
  actorFullName: string | null;
  actorAvatarUrl: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAtUtc: string;
  movieId?: string | null;
  entityTitle?: string | null;
  entityTitleTr?: string | null;
  actorIsFollowedByCurrentUser?: boolean;
}

export interface FriendActivityUser {
  id: string;
  userName: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface FriendActivityMovie {
  id: string;
  title: string;
  posterUrl: string;
  releaseYear: number;
  genre: string | null;
}

export interface FriendActivity {
  user: FriendActivityUser;
  movie: FriendActivityMovie;
  rating: number | null;
  watched: boolean;
  reaction: ReactionType | null;
  hasReview: boolean;
  reviewExcerpt: string | null;
  containsSpoiler: boolean;
  lastActivityAtUtc: string;
}

export interface FriendsActivity {
  followingCount: number;
  weeklyActiveFriendCount: number;
  weeklyActivityCount: number;
  spotlight: FriendActivity | null;
  items: FriendActivity[];
}

export type ActivityFilter =
  | "all"
  | "reviews"
  | "ratings"
  | "diary"
  | "reactions";

export interface ActivityFeedMovie {
  id: string;
  title: string;
  posterUrl: string;
  releaseYear: number;
}

export interface ActivityFeedItem {
  user: FriendActivityUser;
  movie: FriendActivityMovie;
  isCurrentUser: boolean;
  rating: number | null;
  watched: boolean;
  reaction: ReactionType | null;
  hasReview: boolean;
  reviewContent: string | null;
  containsSpoiler: boolean;
  lastActivityAtUtc: string;
}

export interface ActivityFeedPage {
  followingCount: number;
  items: ActivityFeedItem[];
  nextBefore: string | null;
  hasMore: boolean;
}

export interface MovieFriendActivity {
  user: FriendActivityUser;
  rating: number | null;
  watched: boolean;
  reaction: ReactionType | null;
  hasReview: boolean;
  reviewExcerpt: string | null;
  containsSpoiler: boolean;
  lastActivityAtUtc: string;
}

export interface MovieFriendsActivity {
  followingCount: number;
  totalCount: number;
  items: MovieFriendActivity[];
}

export interface WatchlistImportMiss {
  row: number;
  title: string;
  year: number | null;
  reason: "NotFound" | "Ambiguous";
}

export interface WatchlistImportResult {
  totalRows: number;
  added: number;
  alreadyInWatchlist: number;
  duplicateRows: number;
  notFound: WatchlistImportMiss[];
  invalidRows: number;
}
