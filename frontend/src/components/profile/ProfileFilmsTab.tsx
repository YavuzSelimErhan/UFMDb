import { useCallback, useEffect, useState } from "react";
import { profileService, movieService } from "@/services";
import type { WatchedMovie } from "@/types";
import "./ProfileFilmsTab.css";

// VARSAYIM 1: PagedResult<T> = { items: T[]; totalCount: number; page: number; pageSize: number; totalPages: number }
//   (backend'deki PagedResult<T> record'unun camelCase JSON karşılığı)
// VARSAYIM 2: movieService.upsertRating(movieId: string, value: number) mevcut ve MovieRating'i senkronize ediyor
// VARSAYIM 3: profileService.getWatchedFilms artık { page, pageSize, sortBy, hasRating } parametreleri alıyor

const PAGE_SIZE = 24;

type FilterType = "all" | "rated" | "unrated";
type ViewMode = "grid" | "masonry";
type PanelType = "rate" | "delete" | null;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "watched-desc", label: "İzleme tarihi (yeni-eski)" },
  { value: "watched-asc", label: "İzleme tarihi (eski-yeni)" },
  { value: "release-desc", label: "Vizyon tarihi (yeni-eski)" },
  { value: "release-asc", label: "Vizyon tarihi (eski-yeni)" },
  { value: "rating-desc", label: "Puanım (yüksek-düşük)" },
  { value: "rating-asc", label: "Puanım (düşük-yüksek)" },
  { value: "movie-rating-desc", label: "Film puanı (yüksek-düşük)" },
  { value: "movie-rating-asc", label: "Film puanı (düşük-yüksek)" },
  { value: "title-asc", label: "Başlık (A-Z)" },
];

function getInitials(title: string): string {
  return title
    .split(" ")
    .map((w) => w[0])
    .join("");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StarRow({
  rating,
  onRate,
  interactive = false,
}: {
  rating: number | null;
  onRate?: (value: number) => void;
  interactive?: boolean;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue =
    interactive && hoverValue !== null ? hoverValue : (rating ?? 0);

  return (
    <div className="star-row" onMouseLeave={() => setHoverValue(null)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = displayValue >= i;
        const half = !filled && displayValue >= i - 0.5;
        return (
          <span
            key={i}
            className={`star${filled ? " star-filled" : ""}${half ? " star-half" : ""}${
              interactive ? " star-interactive" : ""
            }`}
            onClick={interactive ? () => onRate?.(i) : undefined}
            onMouseEnter={interactive ? () => setHoverValue(i) : undefined}
            role={interactive ? "button" : undefined}
            aria-label={interactive ? `${i} yıldız ver` : undefined}
          >
            {filled ? "★" : half ? "⯨" : "☆"}
          </span>
        );
      })}
    </div>
  );
}

function MovieCard({
  entry,
  isPanelOpen,
  panelType,
  isSaving,
  onOpenPanel,
  onClosePanel,
  onRate,
  onDelete,
}: {
  entry: WatchedMovie;
  isPanelOpen: boolean;
  panelType: PanelType;
  isSaving: boolean;
  onOpenPanel: (type: Exclude<PanelType, null>) => void;
  onClosePanel: () => void;
  onRate: (value: number) => void;
  onDelete: () => void;
}) {
  const { movie, userRating, watchedAtUtc } = entry;

  return (
    <div className="movie-card">
      {movie.posterUrl ? (
        <img
          className="movie-card-poster"
          src={movie.posterUrl}
          alt=""
          loading="lazy"
        />
      ) : (
        <div className="movie-card-initials" aria-hidden="true">
          {getInitials(movie.title)}
        </div>
      )}
      <div className="movie-card-scrim" aria-hidden="true" />

      {userRating !== null && (
        <div className="movie-card-badge">★ {userRating.toFixed(1)}</div>
      )}

      <div className="movie-card-meta">
        <p className="movie-card-title">{movie.title}</p>
        <p className="movie-card-date">{formatDate(watchedAtUtc)}</p>
      </div>

      {!isPanelOpen && (
        <div className="movie-card-actions">
          <button
            type="button"
            className="action-btn"
            onClick={() => onOpenPanel("rate")}
            aria-label="Puanla"
          >
            <i className="ti ti-star" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => onOpenPanel("delete")}
            aria-label="Filmlerimden çıkar"
          >
            <i className="ti ti-trash" aria-hidden="true" />
          </button>
        </div>
      )}

      {isPanelOpen && panelType === "rate" && (
        <div className="movie-card-panel">
          <p className="panel-label">Puanını gir</p>
          <StarRow
            rating={userRating}
            onRate={onRate}
            interactive={!isSaving}
          />
          <button
            type="button"
            className="panel-close"
            onClick={onClosePanel}
            aria-label="Kapat"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      )}

      {isPanelOpen && panelType === "delete" && (
        <div className="movie-card-panel panel-delete">
          <p className="panel-label panel-label-danger">
            Filmlerimden çıkarılsın mı?
          </p>
          <div className="panel-delete-actions">
            <button
              type="button"
              className="confirm-btn"
              onClick={onDelete}
              disabled={isSaving}
              aria-label="Çıkarmayı onayla"
            >
              <i className="ti ti-check" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={onClosePanel}
              aria-label="Vazgeç"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileFilmsTab() {
  const [entries, setEntries] = useState<WatchedMovie[]>([]);
  const [counts, setCounts] = useState({ all: 0, rated: 0, unrated: 0 });
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState("watched-desc");
  const [sortOpen, setSortOpen] = useState(false);
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

  // Sekme sayaçları — her filtre için pageSize:1 ile sadece totalCount alıyoruz
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
        setError("Filmler yüklenirken bir sorun oluştu.");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [sortBy, hasRatingParam],
  );

  useEffect(() => {
    loadPage(1, true);
    // filtre veya sıralama değiştiğinde baştan yükle
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
      setError("Puan kaydedilemedi, tekrar deneyin.");
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
      setError("Kayıt silinemedi, tekrar deneyin.");
    } finally {
      setSavingMovieId(null);
      closePanel();
    }
  };

  return (
    <div className="films-tab">
      <div className="films-toolbar">
        <div className="filter-pills" role="tablist" aria-label="Film filtresi">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`pill${filter === "all" ? " pill-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Tümü <span className="pill-count">· {counts.all}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "rated"}
            className={`pill${filter === "rated" ? " pill-active" : ""}`}
            onClick={() => setFilter("rated")}
          >
            Puanlı <span className="pill-count">· {counts.rated}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "unrated"}
            className={`pill${filter === "unrated" ? " pill-active" : ""}`}
            onClick={() => setFilter("unrated")}
          >
            Puansız <span className="pill-count">· {counts.unrated}</span>
          </button>
        </div>

        <div className="toolbar-right">
          <div className="sort-wrap">
            <button
              type="button"
              className="sort-btn"
              onClick={() => setSortOpen((v) => !v)}
              aria-expanded={sortOpen}
            >
              <i className="ti ti-arrows-sort" aria-hidden="true" />
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
              <i className="ti ti-chevron-down" aria-hidden="true" />
            </button>
            {sortOpen && (
              <div className="sort-menu" role="menu">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitem"
                    className={`sort-option${opt.value === sortBy ? " sort-option-active" : ""}`}
                    onClick={() => {
                      setSortBy(opt.value);
                      setSortOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="view-toggle" role="group" aria-label="Görünüm seçimi">
            <button
              type="button"
              className={`view-btn${viewMode === "grid" ? " view-btn-active" : ""}`}
              onClick={() => setViewMode("grid")}
              aria-label="Izgara görünümü"
              aria-pressed={viewMode === "grid"}
            >
              <i className="ti ti-layout-grid" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`view-btn${viewMode === "masonry" ? " view-btn-active" : ""}`}
              onClick={() => setViewMode("masonry")}
              aria-label="Serbest görünüm"
              aria-pressed={viewMode === "masonry"}
            >
              <i className="ti ti-grid-dots" aria-hidden="true" />
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
                className="load-more-btn"
                onClick={() => loadPage(page + 1, false)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Yükleniyor…" : "Daha fazla göster"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>Bu filtreye uyan film yok.</p>
        </div>
      )}
    </div>
  );
}
