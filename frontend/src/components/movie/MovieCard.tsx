import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Star, Bookmark, Heart, Ticket } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { movieService } from "@/services";
import { useAppSelector } from "@/store";
import { getEntityTheme } from "@/utils/listTheme";
import type { MovieListItem } from "@/types";
import "./MovieCard.css";

interface Props {
  movie: MovieListItem;
  interactive?: boolean;
  userRating?: number | null;
  onUnlike?: () => void;
  onRate?: (value: number) => void;
  isRatingSaving?: boolean;
  onLogClick?: () => void;
  rank?: number;
  compact?: boolean;
}

export default function MovieCard({
  movie,
  interactive = true,
  userRating,
  onUnlike,
  onRate,
  isRatingSaving,
  onLogClick,
  rank,
  compact,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [inWatchlist, setInWatchlist] = useState(
    movie.isInWatchlistByCurrentUser,
  );
  const [isLiked, setIsLiked] = useState(movie.isLikedByCurrentUser);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);

  // movie prop'u cache invalidation sonrası güncellenip aynı MovieCard
  // instance'ı yeniden kullanıldığında (key değişmediği için remount
  // olmuyor), local state'i taze değerle senkronize eder. useState'in
  // başlangıç değeri sadece mount anında okunur, bu yüzden bu senkron
  // olmadan güncel veri gelse bile ekranda eski durum kalırdı.
  useEffect(() => {
    setInWatchlist(movie.isInWatchlistByCurrentUser);
  }, [movie.isInWatchlistByCurrentUser]);

  useEffect(() => {
    setIsLiked(movie.isLikedByCurrentUser);
  }, [movie.isLikedByCurrentUser]);

  // Farklı bir film için aynı kart instance'ı yeniden kullanılırsa
  // (liste kaydırma/sayfalama gibi durumlarda), önceki filmin poster
  // hatası bu filme taşınmasın diye sıfırlanır.
  useEffect(() => {
    setPosterFailed(false);
  }, [movie.id]);

  const watchlistMutation = useMutation({
    mutationFn: () => movieService.toggleWatchlist(movie.id),
    onMutate: () => {
      const previous = inWatchlist;
      setInWatchlist(!previous);
      return { previous };
    },
    onSuccess: (newState) => {
      setInWatchlist(newState);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["movie", movie.id] });
    },
    onError: (_err, _vars, context) => {
      if (context) setInWatchlist(context.previous);
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => movieService.toggleLike(movie.id),
    onMutate: () => {
      const previous = isLiked;
      setIsLiked(!previous);
      return { previous };
    },
    onSuccess: (newState) => {
      setIsLiked(newState);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["movie", movie.id] });
    },
    onError: (_err, _vars, context) => {
      if (context) setIsLiked(context.previous);
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: () => movieService.toggleLike(movie.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      queryClient.invalidateQueries({ queryKey: ["movie", movie.id] });
      onUnlike?.();
    },
  });

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const displayValue = hoverValue ?? userRating ?? 0;
  const showPosterFallback = !movie.posterUrl || posterFailed;
  const theme = getEntityTheme(movie.id);

  // Puan satırı: onRate verilmişse tıklanabilir/gezinebilir, sadece
  // userRating varsa salt-okunur, ikisi de yoksa hiç render edilmiyor.
  const showRatingRow = Boolean(onRate) || userRating != null;

  return (
    <Link
      to={`/movies/${movie.id}`}
      className={`movie-card card${compact ? " movie-card--compact" : ""}`}
    >
      <div className="movie-card__poster-wrap">
        {showPosterFallback ? (
          <div
            className="movie-card__poster-fallback"
            style={
              {
                "--fallback-accent": theme.accent,
                "--fallback-accent-soft": theme.accentSoft,
              } as React.CSSProperties
            }
          >
            <span className="movie-card__poster-fallback-title">
              {movie.title}
            </span>
          </div>
        ) : (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            loading="lazy"
            decoding="async"
            className="movie-card__poster"
            onError={() => setPosterFailed(true)}
          />
        )}

        {rank && (
          <div className="movie-card__rank">
            <span>{rank}</span>
          </div>
        )}

        <div className="movie-card__actions">
          {interactive && isAuthenticated && (
            <button
              className={`movie-card__bookmark ${inWatchlist ? "is-active" : ""}`}
              disabled={watchlistMutation.isPending}
              title={inWatchlist ? t("movie.inList") : t("movie.listShort")}
              aria-label={
                inWatchlist ? t("movie.inList") : t("movie.listShort")
              }
              onClick={(e) => {
                stop(e);
                watchlistMutation.mutate();
              }}
            >
              <Bookmark
                size={13}
                fill={inWatchlist ? "currentColor" : "none"}
              />
            </button>
          )}

          {interactive && isAuthenticated && onLogClick && (
            <button
              type="button"
              className="movie-card__log"
              title={t("movie.logScreening")}
              aria-label={t("movie.logScreening")}
              onClick={(e) => {
                stop(e);
                onLogClick();
              }}
            >
              <Ticket size={13} />
            </button>
          )}

          {interactive && isAuthenticated && !onUnlike && (
            <button
              className={`movie-card__like ${isLiked ? "is-active" : ""}`}
              disabled={likeMutation.isPending}
              title={isLiked ? t("movie.unlike") : t("movie.like")}
              aria-label={isLiked ? t("movie.unlike") : t("movie.like")}
              onClick={(e) => {
                stop(e);
                likeMutation.mutate();
              }}
            >
              <Heart size={13} fill={isLiked ? "currentColor" : "none"} />
            </button>
          )}

          {onUnlike && (
            <button
              className="movie-card__unlike"
              disabled={unlikeMutation.isPending}
              title={t("movie.unlike")}
              aria-label={t("movie.unlike")}
              onClick={(e) => {
                stop(e);
                unlikeMutation.mutate();
              }}
            >
              <Heart size={13} fill="currentColor" />
            </button>
          )}
        </div>
      </div>

      <div className="movie-card__info">
        <h3 className="movie-card__title">{movie.title}</h3>

        {(movie.ratingCount > 0 ||
          movie.releaseYear > 0 ||
          movie.genres?.[0]) && (
          <div className="movie-card__meta">
            {movie.ratingCount > 0 && (
              <span className="movie-card__meta-rating">
                <Star size={12} fill="currentColor" />
                {movie.averageRating.toFixed(1)}
              </span>
            )}
            {movie.releaseYear > 0 && <span>{movie.releaseYear}</span>}
            {movie.genres?.[0] && (
              <span className="movie-card__meta-genre">{movie.genres[0]}</span>
            )}
          </div>
        )}

        {showRatingRow && (
          <div
            className={`movie-card__rate-row${onRate ? " is-interactive" : ""}`}
            onClick={stop}
          >
            {[1, 2, 3, 4, 5].map((i) => {
              const fillRatio = Math.max(
                0,
                Math.min(1, displayValue - (i - 1)),
              );
              return (
                <span key={i} className="movie-card__rate-row-star">
                  <Star size={15} className="movie-card__rate-row-star-base" />
                  <span
                    className="movie-card__rate-row-star-fill"
                    style={{ width: `${fillRatio * 100}%` }}
                  >
                    <Star size={15} fill="currentColor" />
                  </span>
                  {onRate && (
                    <>
                      <button
                        type="button"
                        className="movie-card__rate-row-hit movie-card__rate-row-hit--left"
                        disabled={isRatingSaving}
                        onMouseEnter={() => setHoverValue(i - 0.5)}
                        onMouseLeave={() => setHoverValue(null)}
                        onClick={(e) => {
                          stop(e);
                          onRate(i - 0.5);
                        }}
                        aria-label={t("profile.giveStarRating", {
                          value: (i - 0.5).toFixed(1),
                        })}
                      />
                      <button
                        type="button"
                        className="movie-card__rate-row-hit movie-card__rate-row-hit--right"
                        disabled={isRatingSaving}
                        onMouseEnter={() => setHoverValue(i)}
                        onMouseLeave={() => setHoverValue(null)}
                        onClick={(e) => {
                          stop(e);
                          onRate(i);
                        }}
                        aria-label={t("profile.giveStarRating", {
                          value: i.toFixed(1),
                        })}
                      />
                    </>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Link>
  );
}
