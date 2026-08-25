import { useRef, useState, useEffect, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MovieCard from "@/components/movie/MovieCard";
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
    const card = el.querySelector<HTMLElement>(".movie-card--compact");
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
            <MovieCard
              key={m.id}
              movie={m}
              rank={showRank ? i + 1 : undefined}
              compact
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
