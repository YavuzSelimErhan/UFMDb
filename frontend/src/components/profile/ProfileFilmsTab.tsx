import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpDown, LayoutGrid, LayoutList } from "lucide-react";
import { profileService, movieService } from "@/services";
import Dropdown from "@/components/search/Dropdown";
import MovieCard from "@/components/movie/MovieCard";
import type { WatchedMovie } from "@/types";
import "./ProfileFilmsTab.css";

const PAGE_SIZE = 24;

type FilterType = "all" | "rated" | "unrated";
type ViewMode = "grid" | "masonry";

const SORT_OPTIONS = [
  { value: "watched-desc", labelKey: "watchedDesc" },
  { value: "watched-asc", labelKey: "watchedAsc" },
  { value: "release-desc", labelKey: "releaseDesc" },
  { value: "release-asc", labelKey: "releaseAsc" },
  { value: "rating-desc", labelKey: "myRatingDesc" },
  { value: "rating-asc", labelKey: "myRatingAsc" },
  { value: "movie-rating-desc", labelKey: "filmRatingDesc" },
  { value: "movie-rating-asc", labelKey: "filmRatingAsc" },
  { value: "title-asc", labelKey: "titleAsc" },
];

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProfileFilmsTab() {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<WatchedMovie[]>([]);
  const [counts, setCounts] = useState({ all: 0, rated: 0, unrated: 0 });
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState("watched-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [savingMovieId, setSavingMovieId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasRatingParam = filter === "all" ? undefined : filter === "rated";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [all, rated, unrated] = await Promise.all([
          profileService.getWatchedFilms({ page: 1, pageSize: 1 }),
          profileService.getWatchedFilms({
            page: 1,
            pageSize: 1,
            hasRating: true,
          }),
          profileService.getWatchedFilms({
            page: 1,
            pageSize: 1,
            hasRating: false,
          }),
        ]);
        if (!cancelled) {
          setCounts({
            all: all.totalCount,
            rated: rated.totalCount,
            unrated: unrated.totalCount,
          });
        }
      } catch {
        // sayaçlar ikincil bilgi — sessizce yut
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries.length]);

  const loadPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (replace) setIsLoading(true);
      else setIsLoadingMore(true);
      setError(null);
      try {
        const result = await profileService.getWatchedFilms({
          page: targetPage,
          pageSize: PAGE_SIZE,
          sortBy,
          hasRating: hasRatingParam,
        });
        setEntries((prev) =>
          replace ? result.items : [...prev, ...result.items],
        );
        setPage(result.page);
        setTotalPages(result.totalPages);
      } catch {
        setError(t("profile.filmsLoadError"));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [sortBy, hasRatingParam, t],
  );

  useEffect(() => {
    loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sortBy]);

  const handleRate = async (movieId: string, value: number) => {
    setSavingMovieId(movieId);
    try {
      await movieService.upsertRating(movieId, value);
      setEntries((prev) =>
        prev.map((e) =>
          e.movieId === movieId ? { ...e, userRating: value } : e,
        ),
      );
    } catch {
      setError(t("profile.ratingSaveError"));
    } finally {
      setSavingMovieId(null);
    }
  };

  const handleDelete = async (movieId: string) => {
    setSavingMovieId(movieId);
    try {
      await profileService.removeWatchedFilm(movieId);
      setEntries((prev) => prev.filter((e) => e.movieId !== movieId));
    } catch {
      setError(t("profile.removeError"));
      setSavingMovieId(null);
    }
  };

  return (
    <div className="films-tab">
      <div className="films-toolbar">
        <div
          className="filter-pills"
          role="tablist"
          aria-label={t("profile.filmsFilterAriaLabel")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`pill${filter === "all" ? " pill-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {t("profile.filmsFilterAll")}{" "}
            <span className="pill-count">{counts.all}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "rated"}
            className={`pill${filter === "rated" ? " pill-active" : ""}`}
            onClick={() => setFilter("rated")}
          >
            {t("profile.filmsFilterRated")}{" "}
            <span className="pill-count">{counts.rated}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "unrated"}
            className={`pill${filter === "unrated" ? " pill-active" : ""}`}
            onClick={() => setFilter("unrated")}
          >
            {t("profile.filmsFilterUnrated")}{" "}
            <span className="pill-count">{counts.unrated}</span>
          </button>
        </div>

        <div className="toolbar-right">
          <Dropdown
            icon={<ArrowUpDown size={14} />}
            value={sortBy}
            options={SORT_OPTIONS.map((o) => ({
              value: o.value,
              label: t(`profile.filmsSort.${o.labelKey}`),
            }))}
            onChange={setSortBy}
          />

          <div
            className="view-toggle"
            role="group"
            aria-label={t("profile.viewModeAriaLabel")}
          >
            <button
              type="button"
              className={`view-btn${viewMode === "grid" ? " view-btn-active" : ""}`}
              onClick={() => setViewMode("grid")}
              aria-label={t("profile.gridView")}
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className={`view-btn${viewMode === "masonry" ? " view-btn-active" : ""}`}
              onClick={() => setViewMode("masonry")}
              aria-label={t("profile.freeView")}
              aria-pressed={viewMode === "masonry"}
            >
              <LayoutList size={14} />
            </button>
          </div>
        </div>
      </div>

      {error && <p className="films-error">{error}</p>}

      {isLoading ? (
        <div className="movie-grid movie-grid--6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="film-skeleton" />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <>
          <div
            className={`movie-grid movie-grid--6${viewMode === "masonry" ? " movie-grid-masonry" : ""}`}
          >
            {entries.map((entry) => (
              <MovieCard
                key={entry.movieId}
                movie={entry.movie}
                userRating={entry.userRating}
                onRate={(value) => handleRate(entry.movieId, value)}
                isRatingSaving={savingMovieId === entry.movieId}
                showDelete
                onDelete={() => handleDelete(entry.movieId)}
                isDeleting={savingMovieId === entry.movieId}
                subtitle={formatDate(entry.watchedAtUtc, i18n.language)}
              />
            ))}
          </div>

          {page < totalPages && (
            <div className="load-more-wrap">
              <button
                type="button"
                className="load-more-btn btn-secondary"
                onClick={() => loadPage(page + 1, false)}
                disabled={isLoadingMore}
              >
                {isLoadingMore
                  ? t("profile.loadingMore")
                  : t("profile.loadMore")}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>{t("profile.noFilmsForFilter")}</p>
        </div>
      )}
    </div>
  );
}
