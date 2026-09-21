import { memo } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { getEntityTheme } from "@/utils/listTheme";
import type { MovieListItem } from "@/types";
import "./RecentlyWatchedCard.css";

interface Props {
  movie: MovieListItem;
  rating: number | null;
}

function RecentlyWatchedCardBase({ movie, rating }: Props) {
  const theme = getEntityTheme(movie.id);

  return (
    <Link to={`/movies/${movie.id}`} className="rw-card">
      <div className="rw-card__poster-wrap">
        {movie.posterUrl ? (
          <>
            <img
              src={movie.posterUrl}
              alt={movie.title}
              loading="lazy"
              decoding="async"
              className="rw-card__poster"
              onError={(e) => {
                // React state'i tetiklemeden, doğrudan DOM üzerinden
                // fallback'e geçiyoruz — re-render yaratmaz.
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget
                  .nextElementSibling as HTMLElement | null;
                fallback?.classList.add("is-visible");
              }}
            />
            <div
              className="rw-card__poster-fallback"
              style={
                {
                  "--fallback-accent": theme.accent,
                  "--fallback-accent-soft": theme.accentSoft,
                } as React.CSSProperties
              }
            >
              <span>{movie.title}</span>
            </div>
          </>
        ) : (
          <div
            className="rw-card__poster-fallback is-visible"
            style={
              {
                "--fallback-accent": theme.accent,
                "--fallback-accent-soft": theme.accentSoft,
              } as React.CSSProperties
            }
          >
            <span>{movie.title}</span>
          </div>
        )}
      </div>

      <div className="rw-card__info">
        <h3 className="rw-card__title">{movie.title}</h3>

        {rating != null && (
          <div
            className="rw-card__stars"
            aria-label={`${rating.toFixed(1)} / 5`}
          >
            {[1, 2, 3, 4, 5].map((i) => {
              const fillRatio = Math.max(0, Math.min(1, rating - (i - 1)));
              return (
                <span key={i} className="rw-card__star">
                  <Star size={13} className="rw-card__star-base" />
                  <span
                    className="rw-card__star-fill"
                    style={{ width: `${fillRatio * 100}%` }}
                  >
                    <Star size={13} fill="currentColor" />
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Link>
  );
}

// movie/rating değişmediği sürece yeniden render edilmesin diye memo.
export default memo(RecentlyWatchedCardBase);
