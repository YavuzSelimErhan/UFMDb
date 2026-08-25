import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Heart, Bookmark, CheckCircle2, User, Ticket, X } from "lucide-react";
import { movieService, screeningLogService } from "@/services";
import { useAppSelector } from "@/store";
import { getEntityTheme } from "@/utils/listTheme";
import StarRating from "@/components/movie/StarRating";
import { PageSpinner, PageError } from "@/components/common/PageState";
import "./MovieDetailPage.css";

function todayLocalDateString(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [reviewText, setReviewText] = useState("");
  const [myRating, setMyRating] = useState(0);
  const [isLogging, setIsLogging] = useState(false);
  const [logDate, setLogDate] = useState(todayLocalDateString());
  const [logRating, setLogRating] = useState(0);

  const {
    data: movie,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["movie", id],
    queryFn: () => movieService.getById(id!),
    enabled: !!id,
    retry: 1,
  });

  // Puan ve yorum artık tamamen ayrı kaynaklardan geliyor — biri değişince diğeri sıfırlanmıyor.
  useEffect(() => {
    setMyRating(movie?.myRating ?? 0);
  }, [movie?.myRating]);
  useEffect(() => {
    setReviewText(movie?.myReview?.content ?? "");
  }, [movie?.myReview]);

  const likeMutation = useMutation({
    mutationFn: () => movieService.toggleLike(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["movie", id] }),
  });

  const watchlistMutation = useMutation({
    mutationFn: () => movieService.toggleWatchlist(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["movie", id] }),
  });

  const watchedMutation = useMutation({
    mutationFn: () => movieService.toggleWatched(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movie", id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });

  // Hızlı yıldız: SADECE puan tablosuna yazıyor, Review'e hiç dokunmuyor —
  // bu yüzden artık boş yorum satırı oluşturmuyor.
  const quickRateMutation = useMutation({
    mutationFn: (rating: number) => movieService.upsertRating(id!, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movie", id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => movieService.upsertReview(id!, reviewText),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["movie", id] }),
  });

  const logMutation = useMutation({
    mutationFn: () =>
      screeningLogService.log(
        id!,
        `${logDate}T12:00:00.000Z`,
        logRating > 0 ? logRating : null,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movie", id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["screening-log"] });
      setLogDate(todayLocalDateString());
      setLogRating(0);
      setIsLogging(false);
    },
  });

  if (isLoading) return <PageSpinner label={t("common.loading")} />;
  if (isError || !movie)
    return (
      <PageError
        message={t("errors.movieDetailFailed")}
        onRetry={() => refetch()}
      />
    );

  const theme = getEntityTheme(movie.id);
  const isUnreleased = new Date(movie.releaseDate).getTime() > Date.now();
  const themeStyle = {
    "--print-accent": theme.accent,
    "--print-accent-soft": theme.accentSoft,
    "--print-accent-strong": theme.accentStrong,
  } as React.CSSProperties;
  const printCode = movie.id.replace(/-/g, "").slice(0, 6).toUpperCase();

  const handleQuickRate = (rating: number) => {
    setMyRating(rating);
    quickRateMutation.mutate(rating);
  };

  return (
    <div className="movie-detail" style={themeStyle}>
      <div
        className="movie-detail__backdrop"
        style={{ backgroundImage: `url(${movie.backdropUrl})` }}
      >
        <span className="movie-detail__print-tag">
          {t("movie.printLabel")} <strong>#{printCode}</strong>
        </span>
      </div>

      <div className="container movie-detail__content">
        <div className="movie-detail__poster-col">
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="movie-detail__poster"
          />
        </div>

        <div className="movie-detail__info-col">
          <h1>{movie.title}</h1>

          {movie.genres.length > 0 && (
            <div className="movie-detail__genres">
              {movie.genres.map((g) => (
                <span key={g} className="movie-detail__genre-chip">
                  {g}
                </span>
              ))}
            </div>
          )}

          <div className="movie-detail__ticket-strip">
            <div className="movie-detail__ticket-cell">
              <span className="movie-detail__ticket-label">
                {t("movie.releaseDate")}
              </span>
              <span className="movie-detail__ticket-value">
                {movie.releaseYear}
              </span>
            </div>
            <div className="movie-detail__ticket-cell">
              <span className="movie-detail__ticket-label">
                {t("movie.runtime")}
              </span>
              <span className="movie-detail__ticket-value">
                {movie.runtimeMinutes} {t("movie.minutesUnit")}
              </span>
            </div>
            {movie.country && (
              <div className="movie-detail__ticket-cell">
                <span className="movie-detail__ticket-label">
                  {t("movie.country")}
                </span>
                <span className="movie-detail__ticket-value">
                  {movie.country}
                </span>
              </div>
            )}
            <div className="movie-detail__ticket-cell">
              <span className="movie-detail__ticket-label">
                {t("movie.rating")}
              </span>
              <span className="movie-detail__ticket-value">
                ★ {movie.averageRating.toFixed(1)} ({movie.ratingCount})
              </span>
            </div>
          </div>

          {isAuthenticated && !isUnreleased && (
            <div className="movie-detail__quick-rate">
              <span className="movie-detail__quick-rate-label">
                {t("movie.quickRateLabel")}
              </span>
              <StarRating value={myRating} onChange={handleQuickRate} />
              {quickRateMutation.isPending && (
                <span className="movie-detail__quick-rate-status">
                  {t("movie.savingRating")}
                </span>
              )}
              {!quickRateMutation.isPending && quickRateMutation.isSuccess && (
                <span className="movie-detail__quick-rate-status">
                  <CheckCircle2 size={13} /> {t("movie.ratingSaved")}
                </span>
              )}
            </div>
          )}
          {isAuthenticated && isUnreleased && (
            <p className="movie-detail__quick-rate-status text-muted">
              {t("movie.notYetReleased")}
            </p>
          )}

          {isAuthenticated && (
            <div className="movie-detail__actions">
              <button
                className={`btn-secondary movie-detail__action-btn ${movie.isLikedByCurrentUser ? "active" : ""}`}
                onClick={() => likeMutation.mutate()}
              >
                <Heart
                  size={16}
                  fill={movie.isLikedByCurrentUser ? "#4a90e2" : "none"}
                />
                {movie.isLikedByCurrentUser
                  ? t("movie.liked")
                  : t("movie.like")}
              </button>
              <button
                className={`btn-secondary movie-detail__action-btn ${movie.isInWatchlistByCurrentUser ? "active" : ""}`}
                onClick={() => watchlistMutation.mutate()}
              >
                <Bookmark
                  size={16}
                  fill={movie.isInWatchlistByCurrentUser ? "#4a90e2" : "none"}
                />
                {movie.isInWatchlistByCurrentUser
                  ? t("movie.inWatchlist")
                  : t("movie.addWatchlist")}
              </button>
              <button
                className={`btn-secondary movie-detail__action-btn ${movie.isWatchedByCurrentUser ? "active" : ""}`}
                onClick={() => watchedMutation.mutate()}
              >
                <CheckCircle2
                  size={16}
                  fill={movie.isWatchedByCurrentUser ? "#4a90e2" : "none"}
                  color={movie.isWatchedByCurrentUser ? "#fff" : undefined}
                />
                {movie.isWatchedByCurrentUser
                  ? t("movie.watched")
                  : t("movie.markWatched")}
              </button>
              <button
                className={`btn-secondary movie-detail__action-btn ${isLogging ? "active" : ""}`}
                onClick={() => setIsLogging((s) => !s)}
                disabled={isUnreleased}
                title={isUnreleased ? t("movie.notYetReleased") : undefined}
              >
                <Ticket size={16} />
                {t("movie.logScreening")}
              </button>
            </div>
          )}

          {isLogging && (
            <div className="movie-detail__log-form card">
              <span className="movie-detail__log-form-eyebrow">
                <Ticket size={12} /> {t("log.boxOffice")}
              </span>
              <button
                type="button"
                className="movie-detail__log-form-close"
                onClick={() => setIsLogging(false)}
                aria-label={t("common.cancel")}
              >
                <X size={14} />
              </button>

              <div className="movie-detail__log-form-row">
                <div className="movie-detail__log-form-field">
                  <label>{t("log.addEntryDate")}</label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    max={todayLocalDateString()}
                  />
                </div>
                <div className="movie-detail__log-form-field">
                  <label>{t("log.addEntryRating")}</label>
                  <StarRating value={logRating} onChange={setLogRating} />
                </div>
              </div>

              <button
                className="btn-primary movie-detail__log-form-submit"
                disabled={logMutation.isPending}
                onClick={() => logMutation.mutate()}
              >
                {t("log.addEntrySubmit")}
              </button>
            </div>
          )}

          <div className="movie-detail__perf-divider" aria-hidden="true" />

          <h3 className="movie-detail__section-title">{t("movie.overview")}</h3>
          <p className="movie-detail__overview">{movie.overview}</p>

          {movie.directors.length > 0 && (
            <>
              <h3 className="movie-detail__section-title">
                {t("movie.director")}
              </h3>
              <div className="movie-detail__directors">
                {movie.directors.map((d) => (
                  <Link
                    key={d.id}
                    to={`/directors/${d.id}`}
                    className="movie-detail__director-chip"
                  >
                    {d.photoUrl ? (
                      <img src={d.photoUrl} alt="" />
                    ) : (
                      <span className="movie-detail__director-chip-fallback">
                        <User size={12} />
                      </span>
                    )}
                    <span>{d.fullName}</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          <h3 className="movie-detail__section-title">{t("movie.cast")}</h3>
          <div className="movie-detail__cast-wrap">
            <div className="movie-detail__cast">
              {movie.cast.map((c) => (
                <Link
                  key={c.actorId}
                  to={`/actors/${c.actorId}`}
                  className="movie-detail__cast-item"
                >
                  <img src={c.photoUrl} alt={c.fullName} />
                  <span>{c.fullName}</span>
                  <span className="text-muted">{c.characterName}</span>
                </Link>
              ))}
            </div>
          </div>

          {isAuthenticated && !isUnreleased && (
            <div className="movie-detail__review-box card">
              <h3>{t("movie.writeReview")}</h3>
              <p className="movie-detail__review-rating-hint">
                {t("movie.yourRating")}:{" "}
                {myRating > 0 ? `${myRating} / 5` : "—"}
              </p>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder={t("movie.reviewPlaceholder")}
                rows={4}
              />
              <button
                className="btn-primary"
                disabled={
                  reviewText.trim().length === 0 || reviewMutation.isPending
                }
                onClick={() => reviewMutation.mutate()}
              >
                {t("common.save")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
