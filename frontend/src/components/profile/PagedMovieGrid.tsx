import { Fragment, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MovieListItem } from "@/types";

export const MOVIES_PAGE_SIZE = 24;

interface PagedMovieGridProps {
  movies: MovieListItem[];
  renderCard: (movie: MovieListItem) => ReactNode;
}

export default function PagedMovieGrid({
  movies,
  renderCard,
}: PagedMovieGridProps) {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(MOVIES_PAGE_SIZE);
  const [announcement, setAnnouncement] = useState("");
  const topRef = useRef<HTMLDivElement | null>(null);

  const visible = movies.slice(0, visibleCount);
  const hasMore = visibleCount < movies.length;
  // Liste (ör. beğeni kaldırınca) kısalırsa gereksiz "Daha az göster" çıkmasın.
  const canShowLess = visible.length > MOVIES_PAGE_SIZE;

  const loadMore = () => {
    const next = Math.min(visibleCount + MOVIES_PAGE_SIZE, movies.length);
    setVisibleCount(visibleCount + MOVIES_PAGE_SIZE);
    setAnnouncement(t("profile.filmsLoadedCount", { count: next }));
  };

  const showLess = () => {
    setVisibleCount(MOVIES_PAGE_SIZE);
    setAnnouncement("");
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={topRef} className="paged-grid">
      <div className="movie-grid movie-grid--compact">
        {visible.map((m) => (
          <Fragment key={m.id}>{renderCard(m)}</Fragment>
        ))}
      </div>

      <div className="paged-grid__sr" aria-live="polite">
        {announcement}
      </div>

      {(hasMore || canShowLess) && (
        <div className="paged-grid__actions">
          {hasMore && (
            <button
              type="button"
              className="paged-grid__more btn-secondary"
              onClick={loadMore}
            >
              {t("profile.loadMore")}
            </button>
          )}
          {canShowLess && (
            <button
              type="button"
              className="paged-grid__less"
              onClick={showLess}
            >
              {t("profile.showLess")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
