import { Link } from "react-router-dom";
import { useState } from "react";
import { Star, Bookmark, Heart } from "lucide-react";
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
}

export default function MovieCard({ movie, userRating, onUnlike }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [inWatchlist, setInWatchlist] = useState(
    movie.isInWatchlistByCurrentUser,
  );
  const [isLiked, setIsLiked] = useState(movie.isLikedByCurrentUser);

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

  // VARSAYIM: movieService.toggleLike, actorService/directorService.toggleLike ile aynı şekilde
  // (id) => Promise<boolean> döner. movieService.ts'te yoksa eklenmesi gerekir.
  const unlikeMutation = useMutation({
    mutationFn: () => movieService.toggleLike(movie.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      onUnlike?.();
    },
  });

  return (
    <Link to={`/movies/${movie.id}`} className="movie-card card">
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

        {userRating != null && (
          <div
            className="movie-card__user-rating"
            title={t("movie.yourRating")}
          >
            <Star size={12} fill="#d4af37" stroke="#d4af37" />
            <span>{userRating.toFixed(1)}</span>
          </div>
        )}

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
                e.preventDefault();
                e.stopPropagation();
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
                e.preventDefault();
                e.stopPropagation();
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
                e.preventDefault();
                e.stopPropagation();
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
        <p className="movie-card__meta text-muted">
          {movie.releaseYear} · {movie.genres.slice(0, 2).join(", ")}
        </p>
      </div>
    </Link>
  );
}
