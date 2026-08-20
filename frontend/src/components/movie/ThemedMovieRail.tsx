import { useRef, useState, useEffect, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Star, Heart, Bookmark } from "lucide-react";
import { movieService } from "@/services";
import { useAppSelector } from "@/store";
import type { MovieListItem } from "@/types";
import "./ThemedMovieRail.css";

export type RailTheme = "gold" | "neon" | "teal" | "crimson" | "frost";

const THEME_COLORS: Record<
  RailTheme,
  { accent: string; dim: string; glow: string }
> = {
  gold: {
    accent: "#d4af37",
    dim: "rgba(212,175,55,0.14)",
    glow: "rgba(212,175,55,0.35)",
  },
  neon: {
    accent: "#00ff88",
    dim: "rgba(0,255,136,0.12)",
    glow: "rgba(0,255,136,0.35)",
  },
  teal: {
    accent: "#1a9e8f",
    dim: "rgba(26,158,143,0.14)",
    glow: "rgba(26,158,143,0.30)",
  },
  crimson: {
    accent: "#c0392b",
    dim: "rgba(192,57,43,0.14)",
    glow: "rgba(192,57,43,0.30)",
  },
  frost: {
    accent: "#4a90e2",
    dim: "rgba(74,144,226,0.14)",
    glow: "rgba(74,144,226,0.30)",
  },
};

interface Props {
  eyebrow: string;
  title: string;
  movies: MovieListItem[];
  theme: RailTheme;
  seeAllHref?: string;
  showRank?: boolean;
}

export default function ThemedMovieRail({
  eyebrow,
  title,
  movies,
  theme,
  seeAllHref,
  showRank,
}: Props) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [progress, setProgress] = useState(0);
  const colors = THEME_COLORS[theme];

  const sync = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
    setProgress(max > 0 ? (el.scrollLeft / max) * 100 : 0);
  };

  useEffect(() => {
    sync();
  }, [movies]);

  const scrollByCards = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".rail-card");
    const gap = parseInt(getComputedStyle(el).gap || "16", 10);
    const step = card ? (card.getBoundingClientRect().width + gap) * 3 : 400;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const dragState = useRef({ isDown: false, startX: 0, startScroll: 0 });
  const onMouseDown = (e: MouseEvent) => {
    const el = trackRef.current;
    if (!el) return;
    dragState.current = {
      isDown: true,
      startX: e.pageX - el.offsetLeft,
      startScroll: el.scrollLeft,
    };
  };
  const onMouseMove = (e: MouseEvent) => {
    const el = trackRef.current;
    if (!el || !dragState.current.isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft =
      dragState.current.startScroll - (x - dragState.current.startX);
  };
  const endDrag = () => {
    dragState.current.isDown = false;
  };

  if (movies.length === 0) return null;

  return (
    <section
      className="rail"
      style={
        {
          "--rail-accent": colors.accent,
          "--rail-accent-dim": colors.dim,
          "--rail-glow": colors.glow,
        } as React.CSSProperties
      }
    >
      <div className="rail__header">
        <div className="rail__label-wrap">
          <p className="rail__eyebrow">{eyebrow}</p>
          <h2 className="rail__title">{title}</h2>
        </div>
        {seeAllHref && (
          <Link to={seeAllHref} className="rail__see-all">
            {t("home.seeAll")} <ChevronRight size={14} />
          </Link>
        )}
      </div>

      <div className="rail__track-wrap">
        <button
          className={`rail__arrow rail__arrow--left ${atStart ? "is-hidden" : ""}`}
          onClick={() => scrollByCards(-1)}
          aria-label={t("common.back")}
        >
          <ChevronLeft size={18} />
        </button>

        <div
          className="rail__track"
          ref={trackRef}
          onScroll={sync}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          {movies.map((m, i) => (
            <RailCard
              key={m.id}
              movie={m}
              rank={showRank ? i + 1 : undefined}
            />
          ))}
        </div>

        <button
          className={`rail__arrow rail__arrow--right ${atEnd ? "is-hidden" : ""}`}
          onClick={() => scrollByCards(1)}
          aria-label={t("common.forward")}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="rail__progress">
        <div
          className="rail__progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}

function RailCard({ movie, rank }: { movie: MovieListItem; rank?: number }) {
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

  return (
    <div className="rail-card">
      <Link to={`/movies/${movie.id}`} className="rail-card__poster">
        <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
        {rank && (
          <div className="rail-card__rank">
            <span>{rank}</span>
          </div>
        )}
        {movie.genres[0] && (
          <div className="rail-card__badge">{movie.genres[0]}</div>
        )}

        {isAuthenticated && (
          <div className="rail-card__actions">
            <button
              className={`rail-card__bookmark ${inWatchlist ? "is-active" : ""}`}
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

            <button
              className={`rail-card__like ${isLiked ? "is-active" : ""}`}
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
          </div>
        )}

        <div className="rail-card__overlay">
          <p className="rail-card__overlay-title">{movie.title}</p>
          <p className="rail-card__overlay-rating">
            <Star size={12} fill="currentColor" />{" "}
            {movie.averageRating.toFixed(1)}
          </p>
        </div>
      </Link>
      <div className="rail-card__foot">
        <p className="rail-card__name">{movie.title}</p>
        <p className="rail-card__meta">
          <span className="rail-card__star">★</span>{" "}
          {movie.averageRating.toFixed(1)}{" "}
          <span className="text-muted">{movie.releaseYear}</span>
        </p>
      </div>
    </div>
  );
}
