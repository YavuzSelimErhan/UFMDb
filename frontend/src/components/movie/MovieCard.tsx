import { Link } from "react-router-dom";
import { useState } from "react";
import { Star, Bookmark, Heart, Trash2, Check, X, Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { movieService } from "@/services";
import { useAppSelector } from "@/store";
import type { MovieListItem } from "@/types";
import "./MovieCard.css";

interface Props {
  movie: MovieListItem;
  userRating?: number | null; // verilmişse "senin puanın" rozetini gösterir
  onUnlike?: () => void; // verilmişse kalp butonu gösterir, beğenmekten çıkarınca çağrılır
  onRate?: (value: number) => void; // verilmişse rating rozetine tıklanınca puanlama paneli açılır
  isRatingSaving?: boolean;
  showDelete?: boolean; // sağ-alt köşede silme butonu gösterir
  onDelete?: () => void;
  isDeleting?: boolean;
  rank?: number; // rail'lerde sıralama rozeti
  compact?: boolean; // yatay kaydırmalı rail içinde sabit genişlik
  subtitle?: string; // alt bilgi satırını override eder (örn. izlenme tarihi)
}

export default function MovieCard({
  movie,
  userRating,
  onUnlike,
  onRate,
  isRatingSaving,
  showDelete,
  onDelete,
  isDeleting,
  rank,
  compact,
  subtitle,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [inWatchlist, setInWatchlist] = useState(
    movie.isInWatchlistByCurrentUser,
  );
  const [isLiked, setIsLiked] = useState(movie.isLikedByCurrentUser);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [hoverValue, setHoverValue] = useState<number | null>(null);

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
    },
    onError: (_err, _vars, context) => {
      if (context) setIsLiked(context.previous);
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: () => movieService.toggleLike(movie.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      onUnlike?.();
    },
  });

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const displayValue = hoverValue ?? userRating ?? 0;

  return (
    <Link
      to={`/movies/${movie.id}`}
      className={`movie-card card${compact ? " movie-card--compact" : ""}`}
    >
      <div className="movie-card__poster-wrap">
        <img
          src={movie.posterUrl}
          alt={movie.title}
          loading="lazy"
          className="movie-card__poster"
        />

        <div className="movie-card__rating">
          <Star size={13} fill="#4a90e2" stroke="#4a90e2" />
          <span>{movie.averageRating.toFixed(1)}</span>
        </div>

        {rank && (
          <div className="movie-card__rank">
            <span>{rank}</span>
          </div>
        )}

        {/* Sol alt: kullanıcının kendi puanı / puanlama girişi */}
        {!isRatingOpen && userRating != null && (
          <button
            type="button"
            className={`movie-card__user-rating${onRate ? " is-clickable" : ""}`}
            title={t("movie.yourRating")}
            onClick={
              onRate
                ? (e) => {
                    stop(e);
                    setIsRatingOpen(true);
                  }
                : undefined
            }
          >
            <Star size={12} fill="#d4af37" stroke="#d4af37" />
            <span>{userRating.toFixed(1)}</span>
            {onRate && (
              <Pencil size={10} className="movie-card__user-rating-edit" />
            )}
          </button>
        )}

        {!isRatingOpen && onRate && userRating == null && (
          <button
            type="button"
            className="movie-card__rate-cta"
            title={t("profile.rateFilm")}
            onClick={(e) => {
              stop(e);
              setIsRatingOpen(true);
            }}
          >
            <Star size={13} />
          </button>
        )}

        {isRatingOpen && (
          <div className="movie-card__rate-panel" onClick={stop}>
            <div
              className="movie-card__rate-stars"
              onMouseLeave={() => setHoverValue(null)}
            >
              {[1, 2, 3, 4, 5].map((i) => {
                const fillRatio = Math.max(
                  0,
                  Math.min(1, displayValue - (i - 1)),
                );
                return (
                  <span key={i} className="movie-card__rate-star">
                    <Star size={15} className="movie-card__rate-star-base" />
                    <span
                      className="movie-card__rate-star-fill"
                      style={{ width: `${fillRatio * 100}%` }}
                    >
                      <Star size={15} fill="currentColor" />
                    </span>
                    <button
                      type="button"
                      className="movie-card__rate-hit movie-card__rate-hit--left"
                      disabled={isRatingSaving}
                      onMouseEnter={() => setHoverValue(i - 0.5)}
                      onClick={(e) => {
                        stop(e);
                        onRate?.(i - 0.5);
                        setIsRatingOpen(false);
                      }}
                      aria-label={t("profile.giveStarRating", {
                        value: (i - 0.5).toFixed(1),
                      })}
                    />
                    <button
                      type="button"
                      className="movie-card__rate-hit movie-card__rate-hit--right"
                      disabled={isRatingSaving}
                      onMouseEnter={() => setHoverValue(i)}
                      onClick={(e) => {
                        stop(e);
                        onRate?.(i);
                        setIsRatingOpen(false);
                      }}
                      aria-label={t("profile.giveStarRating", {
                        value: i.toFixed(1),
                      })}
                    />
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              className="movie-card__rate-close"
              onClick={(e) => {
                stop(e);
                setIsRatingOpen(false);
              }}
              aria-label={t("common.close")}
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Sol üst: watchlist + like */}
        <div className="movie-card__actions">
          {isAuthenticated && (
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

          {isAuthenticated && !onUnlike && (
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

        {/* Sağ alt: silme (Films sekmesi) */}
        {showDelete && !isDeleteOpen && (
          <button
            type="button"
            className="movie-card__delete"
            title={t("profile.removeFromWatched")}
            aria-label={t("profile.removeFromWatched")}
            onClick={(e) => {
              stop(e);
              setIsDeleteOpen(true);
            }}
          >
            <Trash2 size={13} />
          </button>
        )}

        {isDeleteOpen && (
          <div className="movie-card__delete-confirm" onClick={stop}>
            <button
              type="button"
              className="movie-card__delete-confirm-yes"
              disabled={isDeleting}
              aria-label={t("common.confirm")}
              onClick={(e) => {
                stop(e);
                onDelete?.();
              }}
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              className="movie-card__delete-confirm-no"
              aria-label={t("common.cancel")}
              onClick={(e) => {
                stop(e);
                setIsDeleteOpen(false);
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
      <div className="movie-card__info">
        <h3 className="movie-card__title">{movie.title}</h3>
        <p className="movie-card__meta text-muted">
          {subtitle ??
            `${movie.releaseYear} · ${movie.genres.slice(0, 2).join(", ")}`}
        </p>
      </div>
    </Link>
  );
}
