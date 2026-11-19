import { localScreeningTime } from "@/utils/screeningTime";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Heart,
  HeartCrack,
  Bookmark,
  CheckCircle2,
  Ticket,
  X,
  Trash2,
  PenLine,
  AlertTriangle,
} from "lucide-react";
import type { MovieDetail, ReactionType } from "@/types";
import ReviewsSection from "@/components/movie/ReviewsSection";
import MovieExtraSections from "./MovieExtraSections";
import MovieFriendsActivity from "./MovieFriendsActivity";
import { movieService, screeningLogService } from "@/services";
import { useToast } from "@/components/common/Toast";
import { useAppSelector } from "@/store";
import { getEntityTheme } from "@/utils/listTheme";
import StarRating from "@/components/movie/StarRating";
import PersonAvatar from "@/components/common/PersonAvatar";
import { PageSpinner, PageError } from "@/components/common/PageState";
import "./MovieDetailPage.css";


export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [reviewText, setReviewText] = useState("");
  const [myRating, setMyRating] = useState(0);
  const [isLogging, setIsLogging] = useState(false);
  const [logDate, setLogDate] = useState(localScreeningTime());
  const [logRating, setLogRating] = useState(0);
  const { showToast } = useToast();
  // undefined = kullanıcı dokunmadı (güncel tepki geçerli), null = bilerek temizledi
  const [logReaction, setLogReaction] = useState<
    ReactionType | null | undefined
  >(undefined);
  const [containsSpoiler, setContainsSpoiler] = useState(false);

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

  const currentReaction = movie?.currentUserReaction ?? null;
  const logReactionValue =
    logReaction === undefined ? currentReaction : logReaction;
  const pickLogReaction = (r: ReactionType) =>
    setLogReaction(logReactionValue === r ? null : r);

  // Form kapanınca seçim sıfırlanır, tekrar açılınca güncel tepkiyle başlar.
  useEffect(() => {
    if (!isLogging) setLogReaction(undefined);
  }, [isLogging]);

  // Puan ve yorum artık tamamen ayrı kaynaklardan geliyor — biri değişince diğeri sıfırlanmıyor.
  useEffect(() => {
    setMyRating(movie?.myRating ?? 0);
  }, [movie?.myRating]);
  useEffect(() => {
    setReviewText(movie?.myReview?.content ?? "");
  }, [movie?.myReview]);
  useEffect(() => {
    setContainsSpoiler(movie?.myReview?.containsSpoiler ?? false);
  }, [movie?.myReview]);

  const reactMutation = useMutation({
    mutationFn: (r: ReactionType) =>
      r === "Like" ? movieService.like(id!) : movieService.dislike(id!),
    onSuccess: (result) => {
      queryClient.setQueryData<MovieDetail>(
        ["movie", id],
        (old) =>
          old && {
            ...old,
            currentUserReaction: result.currentUserReaction,
            isLikedByCurrentUser: result.currentUserReaction === "Like",
            likeCount: result.likeCount,
            dislikeCount: result.dislikeCount,
          },
      );
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["watched-films"] });
    },
  });

  const watchlistMutation = useMutation({
    mutationFn: () => movieService.toggleWatchlist(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["movie", id] }),
  });

  const [watchedError, setWatchedError] = useState<string | null>(null);

  const watchedMutation = useMutation({
    mutationFn: () => movieService.toggleWatched(id!),
    onSuccess: () => {
      setWatchedError(null);
      queryClient.invalidateQueries({ queryKey: ["movie", id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["watched-films-counts"] });
      queryClient.invalidateQueries({ queryKey: ["watched-films"] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { title?: string } } })
        ?.response?.data?.title;
      setWatchedError(message ?? t("movie.watchedToggleError"));
    },
  });

  // Hızlı yıldız: SADECE puan tablosuna yazıyor, Review'e hiç dokunmuyor —
  // bu yüzden artık boş yorum satırı oluşturmuyor.
  const quickRateMutation = useMutation({
    mutationFn: (rating: number) => movieService.upsertRating(id!, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movie", id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["watched-films-counts"] });
      queryClient.invalidateQueries({ queryKey: ["watched-films"] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      movieService.upsertReview(id!, reviewText, containsSpoiler),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movie", id] });
      queryClient.invalidateQueries({
        queryKey: ["movie-reviews", id],
        exact: false,
      });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: () => movieService.deleteReview(id!),
    onSuccess: () => {
      setReviewText("");
      setContainsSpoiler(false);
      queryClient.invalidateQueries({ queryKey: ["movie", id] });
      queryClient.invalidateQueries({
        queryKey: ["movie-reviews", id],
        exact: false,
      });
    },
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      await screeningLogService.log(
        id!,
        new Date(logDate).toISOString(),
        logRating > 0 ? logRating : null,
      );
      // Seans yazıldıktan sonra tepkiyi uygula; hata olursa seansı geri almıyoruz
      // (kullanıcı tekrar deneyip çift kayıt oluşturmasın), sadece haber veriyoruz.
      try {
        await movieService.setReaction(id!, logReactionValue, currentReaction);
        return { reactionFailed: false };
      } catch {
        return { reactionFailed: true };
      }
    },
    onSuccess: ({ reactionFailed }) => {
      queryClient.invalidateQueries({ queryKey: ["movie", id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["watched-films"] });
      queryClient.invalidateQueries({ queryKey: ["watched-films-counts"] });
      queryClient.invalidateQueries({ queryKey: ["screening-log"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["list"] });
      if (reactionFailed) showToast(t("log.reactionSaveError"), "error");
      setLogDate(localScreeningTime());
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

          {movie.tagline && (
            <p className="movie-detail__tagline">“{movie.tagline}”</p>
          )}

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
                {new Date(movie.releaseDate).toLocaleDateString(
                  i18n.language === "tr" ? "tr-TR" : "en-US",
                  { day: "numeric", month: "long", year: "numeric" },
                )}
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
            {movie.certification && (
              <div className="movie-detail__ticket-cell">
                <span className="movie-detail__ticket-label">
                  {t("movie.extras.ageRating")}
                </span>
                <span className="movie-detail__ticket-value">
                  <span className="movie-detail__cert-stamp">
                    {movie.certification}
                  </span>
                  {movie.certificationCountry && (
                    <span className="movie-detail__cert-country">
                      {movie.certificationCountry}
                    </span>
                  )}
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
              <div
                className="movie-detail__reaction"
                role="group"
                aria-label={t("movie.reactionGroup")}
              >
                <button
                  type="button"
                  className={`movie-detail__reaction-btn movie-detail__reaction-btn--like ${
                    movie.currentUserReaction === "Like" ? "active" : ""
                  }`}
                  aria-pressed={movie.currentUserReaction === "Like"}
                  disabled={reactMutation.isPending}
                  onClick={() => reactMutation.mutate("Like")}
                >
                  <Heart
                    size={16}
                    fill={
                      movie.currentUserReaction === "Like"
                        ? "currentColor"
                        : "none"
                    }
                  />
                  {movie.currentUserReaction === "Like"
                    ? t("movie.liked")
                    : t("movie.like")}
                </button>
                <button
                  type="button"
                  className={`movie-detail__reaction-btn movie-detail__reaction-btn--dislike ${
                    movie.currentUserReaction === "Dislike" ? "active" : ""
                  }`}
                  aria-pressed={movie.currentUserReaction === "Dislike"}
                  disabled={reactMutation.isPending}
                  title={t("movie.notForMeHint")}
                  onClick={() => reactMutation.mutate("Dislike")}
                >
                  <HeartCrack size={16} />
                  {t("movie.notForMe")}
                </button>
              </div>
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
                disabled={isUnreleased}
                title={isUnreleased ? t("movie.notYetReleased") : undefined}
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

          {watchedError && (
            <p className="movie-detail__watched-error">{watchedError}</p>
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
                    type="datetime-local"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    max={localScreeningTime()}
                  />
                </div>
                <div className="movie-detail__log-form-field">
                  <label>{t("log.addEntryRating")}</label>
                  <StarRating value={logRating} onChange={setLogRating} />
                </div>
              </div>

              <div className="movie-detail__log-form-field movie-detail__log-form-reaction">
                <label>{t("log.reactionLabel")}</label>
                <div
                  className="movie-detail__log-reaction-group"
                  role="group"
                  aria-label={t("log.reactionLabel")}
                >
                  <button
                    type="button"
                    className={`movie-detail__log-reaction-btn is-like${logReactionValue === "Like" ? " is-active" : ""}`}
                    aria-pressed={logReactionValue === "Like"}
                    disabled={logMutation.isPending}
                    onClick={() => pickLogReaction("Like")}
                  >
                    <Heart
                      size={14}
                      fill={
                        logReactionValue === "Like" ? "currentColor" : "none"
                      }
                    />
                    {t("log.reactionLike")}
                  </button>
                  <button
                    type="button"
                    className={`movie-detail__log-reaction-btn is-dislike${logReactionValue === "Dislike" ? " is-active" : ""}`}
                    aria-pressed={logReactionValue === "Dislike"}
                    disabled={logMutation.isPending}
                    onClick={() => pickLogReaction("Dislike")}
                  >
                    <HeartCrack size={14} />
                    {t("movie.notForMe")}
                  </button>
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
                    className="movie-detail__director-card"
                  >
                    <PersonAvatar
                      id={d.id}
                      photoUrl={d.photoUrl}
                      fullName={d.fullName}
                      size="sm"
                    />
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
                  <PersonAvatar
                    id={c.actorId}
                    photoUrl={c.photoUrl}
                    fullName={c.fullName}
                    size="sm"
                  />
                  <span>{c.fullName}</span>
                  <span className="text-muted">{c.characterName}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Takip edilenlerin bu filmdeki hareketi (giriş yapmamışsa kendini gizler) */}
          <MovieFriendsActivity
            key={`friends-${movie.id}`}
            movieId={movie.id}
          />

          {/* Fragman, galeri, yapım fişi, etiketler, seri koçanları */}
          <MovieExtraSections
            key={movie.id}
            movie={movie}
            printCode={printCode}
          />

          {isAuthenticated && !isUnreleased && (
            <div className="movie-detail__review-box card">
              <div className="movie-detail__review-header">
                <span className="movie-detail__review-eyebrow">
                  <PenLine size={12} /> {t("movie.writeReview")}
                </span>
                <span className="movie-detail__review-rating-hint">
                  {t("movie.yourRating")}:{" "}
                  <strong>{myRating > 0 ? `${myRating} / 5` : "—"}</strong>
                </span>
              </div>

              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder={t("movie.reviewPlaceholder")}
                rows={4}
              />

              <div className="movie-detail__review-footer">
                <button
                  type="button"
                  className={`movie-detail__spoiler-toggle ${containsSpoiler ? "active" : ""}`}
                  onClick={() => setContainsSpoiler((s) => !s)}
                  aria-pressed={containsSpoiler}
                >
                  <AlertTriangle size={13} />
                  {t("movie.containsSpoiler")}
                </button>

                <div className="movie-detail__review-actions">
                  <button
                    className="btn-primary"
                    disabled={
                      reviewText.trim().length === 0 || reviewMutation.isPending
                    }
                    onClick={() => reviewMutation.mutate()}
                  >
                    {t("common.save")}
                  </button>
                  {movie.myReview && (
                    <button
                      className="btn-secondary movie-detail__review-delete"
                      disabled={deleteReviewMutation.isPending}
                      onClick={() => deleteReviewMutation.mutate()}
                    >
                      <Trash2 size={14} /> {t("common.delete")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <ReviewsSection movieId={id!} isAuthenticated={isAuthenticated} />
        </div>
      </div>
    </div>
  );
}
