import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Play, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import { movieService } from "@/services";
import { useAppSelector } from "@/store";
import type { MovieListItem } from "@/types";
import "./HeroCarousel.css";

interface Props {
  movies: MovieListItem[];
}

const AUTO_ADVANCE_MS = 6500;

export default function HeroCarousel({ movies }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [activeIndex, setActiveIndex] = useState(0);
  const count = movies.length;

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(((index % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(
      () => setActiveIndex((i) => (i + 1) % count),
      AUTO_ADVANCE_MS,
    );
    return () => clearInterval(timer);
  }, [count]);

  const active = movies[activeIndex];

  // Aktif slayt değişince izleme listesi durumunu o filmin kendi verisiyle senkronize et
  const [inWatchlist, setInWatchlist] = useState(
    active?.isInWatchlistByCurrentUser ?? false,
  );
  useEffect(() => {
    setInWatchlist(active?.isInWatchlistByCurrentUser ?? false);
  }, [active?.id]);

  const watchlistMutation = useMutation({
    mutationFn: () => movieService.toggleWatchlist(active.id),
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

  if (count === 0) return null;

  return (
    <div className="hero-carousel">
      {movies.map((m, i) => (
        <div
          key={m.id}
          className={`hero-carousel__slide ${i === activeIndex ? "is-active" : ""}`}
          style={{ backgroundImage: `url(${m.backdropUrl || m.posterUrl})` }}
        />
      ))}
      <div className="hero-carousel__scrim" />

      {count > 1 && (
        <>
          <button
            className="hero-carousel__nav hero-carousel__nav--prev"
            onClick={() => goTo(activeIndex - 1)}
            aria-label={t("common.back")}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="hero-carousel__nav hero-carousel__nav--next"
            onClick={() => goTo(activeIndex + 1)}
            aria-label={t("common.forward")}
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      <div className="container hero-carousel__content">
        <span className="hero-carousel__eyebrow">{t("home.featured")}</span>
        <h1 className="hero-carousel__title">{active.title}</h1>

        <div className="hero-carousel__meta">
          <span className="hero-carousel__rating">
            <Star size={15} fill="#4a90e2" stroke="#4a90e2" />{" "}
            {active.averageRating.toFixed(1)}
          </span>
          <span>{active.releaseYear}</span>
          <span>{active.genres.slice(0, 3).join(" · ")}</span>
        </div>

        {active.overview && (
          <p className="hero-carousel__overview">{active.overview}</p>
        )}

        <div className="hero-carousel__actions">
          <Link
            to={`/movies/${active.id}`}
            className="btn-primary hero-carousel__btn"
          >
            <Play size={16} fill="#fff" /> {t("movie.viewDetails")}
          </Link>
          {isAuthenticated && (
            <button
              className={`btn-secondary hero-carousel__btn ${inWatchlist ? "is-active" : ""}`}
              disabled={watchlistMutation.isPending}
              onClick={() => watchlistMutation.mutate()}
            >
              <Bookmark
                size={16}
                fill={inWatchlist ? "currentColor" : "none"}
              />
              {inWatchlist ? t("movie.inList") : t("movie.listShort")}
            </button>
          )}
        </div>

        <div className="hero-carousel__dots">
          {movies.map((_, i) => (
            <button
              key={i}
              className={`hero-carousel__dot ${i === activeIndex ? "is-active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
