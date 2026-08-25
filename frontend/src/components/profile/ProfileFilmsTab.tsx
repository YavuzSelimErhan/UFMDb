import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Star,
  Trash2,
  X,
  Check,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
} from "lucide-react";
import { profileService, movieService } from "@/services";
import Dropdown from "@/components/search/Dropdown";
import type { WatchedMovie } from "@/types";
import "./ProfileFilmsTab.css";

const PAGE_SIZE = 24;

type FilterType = "all" | "rated" | "unrated";
type ViewMode = "grid" | "masonry";
type PanelType = "rate" | "delete" | null;

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

function getInitials(title: string): string {
  return title
    .split(" ")
    .map((w) => w[0])
    .join("");
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Yarım yıldız destekli puanlama satırı. Her yıldız görünmez iki hit-area'ya
// bölünmüş: sola tıklamak x.5, sağa tıklamak x.0 değeri veriyor. Dolgu oranı
// (fillRatio) 0-1 arası hesaplanıp SVG'nin üstüne bindirilen kırpılmış bir
// kopyayla gösteriliyor, böylece 3.5 gibi değerler de görsel olarak doğru.
function StarRow({
  rating,
  onRate,
  interactive = false,
}: {
  rating: number | null;
  onRate?: (value: number) => void;
  interactive?: boolean;
}) {
  const { t } = useTranslation();
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue =
    interactive && hoverValue !== null ? hoverValue : (rating ?? 0);

  return (
    <div className="star-row" onMouseLeave={() => setHoverValue(null)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fillRatio = Math.max(0, Math.min(1, displayValue - (i - 1)));
        return (
          <span
            key={i}
            className={`star${interactive ? " star-interactive" : ""}`}
          >
            <Star size={16} className="star-base" />
            <span
              className="star-fill"
              style={{ width: `${fillRatio * 100}%` }}
            >
              <Star size={16} fill="currentColor" />
            </span>
            {interactive && (
              <>
                <button
                  type="button"
                  className="star-hit star-hit--left"
                  onMouseEnter={() => setHoverValue(i - 0.5)}
                  onFocus={() => setHoverValue(i - 0.5)}
                  onClick={() => onRate?.(i - 0.5)}
                  aria-label={t("profile.giveStarRating", {
                    value: (i - 0.5).toFixed(1),
                  })}
                />
                <button
                  type="button"
                  className="star-hit star-hit--right"
                  onMouseEnter={() => setHoverValue(i)}
                  onFocus={() => setHoverValue(i)}
                  onClick={() => onRate?.(i)}
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
  );
}

function MovieCard({
  entry,
  locale,
  isPanelOpen,
  panelType,
  isSaving,
  onOpenPanel,
  onClosePanel,
  onRate,
  onDelete,
}: {
  entry: WatchedMovie;
  locale: string;
  isPanelOpen: boolean;
  panelType: PanelType;
  isSaving: boolean;
  onOpenPanel: (type: Exclude<PanelType, null>) => void;
  onClosePanel: () => void;
  onRate: (value: number) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { movie, userRating, watchedAtUtc } = entry;

  return (
    <div className="movie-card card">
      <Link
        to={`/movies/${movie.id}`}
        className="movie-card-link"
        tabIndex={isPanelOpen ? -1 : 0}
      >
        {movie.posterUrl ? (
          <img
            className="movie-card-poster"
            src={movie.posterUrl}
            alt={movie.title}
            loading="lazy"
          />
        ) : (
          <div className="movie-card-initials" aria-hidden="true">
            {getInitials(movie.title)}
          </div>
        )}
        <div className="movie-card-scrim" aria-hidden="true" />

        <div className="movie-card-meta">
          <p className="movie-card-title">{movie.title}</p>
          <div className="movie-card-subrow">
            <p className="movie-card-date">
              {formatDate(watchedAtUtc, locale)}
            </p>
            {userRating !== null && (
              <span className="movie-card-rating">
                <Star size={11} fill="currentColor" /> {userRating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </Link>

      {!isPanelOpen && (
        <div className="movie-card-actions">
          <button
            type="button"
            className="action-btn"
            onClick={() => onOpenPanel("rate")}
            aria-label={t("profile.rateFilm")}
          >
            <Star size={13} />
          </button>
          <button
            type="button"
            className="action-btn action-btn--danger"
            onClick={() => onOpenPanel("delete")}
            aria-label={t("profile.removeFromWatched")}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {isPanelOpen && panelType === "rate" && (
        <div className="movie-card-panel">
          <p className="panel-label">{t("profile.enterRating")}</p>
          <StarRow
            rating={userRating}
            onRate={onRate}
            interactive={!isSaving}
          />
          <button
            type="button"
            className="panel-close"
            onClick={onClosePanel}
            aria-label={t("common.close")}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {isPanelOpen && panelType === "delete" && (
        <div className="movie-card-panel panel-delete">
          <p className="panel-label panel-label-danger">
            {t("profile.confirmRemoveWatched")}
          </p>
          <div className="panel-delete-actions">
            <button
              type="button"
              className="confirm-btn"
              onClick={onDelete}
              disabled={isSaving}
              aria-label={t("common.confirm")}
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={onClosePanel}
              aria-label={t("common.cancel")}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [activePanelType, setActivePanelType] = useState<PanelType>(null);
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

  const openPanel = (id: string, type: Exclude<PanelType, null>) => {
    setActivePanelId(id);
    setActivePanelType(type);
  };

  const closePanel = () => {
    setActivePanelId(null);
    setActivePanelType(null);
  };

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
      closePanel();
    }
  };

  const handleDelete = async (movieId: string) => {
    setSavingMovieId(movieId);
    try {
      await profileService.removeWatchedFilm(movieId);
      setEntries((prev) => prev.filter((e) => e.movieId !== movieId));
    } catch {
      setError(t("profile.removeError"));
    } finally {
      setSavingMovieId(null);
      closePanel();
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
            <div key={i} className="movie-card movie-card-skeleton" />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <>
          <div
            className={`movie-grid movie-grid--6${
              viewMode === "masonry" ? " movie-grid-masonry" : ""
            }`}
          >
            {entries.map((entry) => (
              <MovieCard
                key={entry.movieId}
                entry={entry}
                locale={i18n.language}
                isPanelOpen={activePanelId === entry.movieId}
                panelType={
                  activePanelId === entry.movieId ? activePanelType : null
                }
                isSaving={savingMovieId === entry.movieId}
                onOpenPanel={(type) => openPanel(entry.movieId, type)}
                onClosePanel={closePanel}
                onRate={(value) => handleRate(entry.movieId, value)}
                onDelete={() => handleDelete(entry.movieId)}
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
