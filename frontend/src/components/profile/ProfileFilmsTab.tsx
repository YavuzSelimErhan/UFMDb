import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, LayoutGrid, LayoutList } from "lucide-react";
import { profileService, movieService } from "@/services";
import Dropdown from "@/components/search/Dropdown";
import MovieCard from "@/components/movie/MovieCard";
import { useWatchedFilmsCounts } from "@/hooks/useWatchedFilmsCounts";
import { useScreeningLogModal } from "@/hooks/useScreeningLogModal";
import type { WatchedMovie } from "@/types";
import "./ProfileFilmsTab.css";

const PAGE_SIZE = 24;
const DEFAULT_SORT = "release-desc";

type FilterType = "all" | "rated" | "unrated";
type ViewMode = "grid" | "masonry";
type FilmsPage = { items: WatchedMovie[]; page: number; totalPages: number };

// İzlenme tarihine göre sıralama kaldırıldı; varsayılan artık çıkış
// tarihine göre yeni -> eski.
const SORT_OPTIONS = [
  { value: "release-desc", labelKey: "releaseDesc" },
  { value: "release-asc", labelKey: "releaseAsc" },
  { value: "rating-desc", labelKey: "myRatingDesc" },
  { value: "rating-asc", labelKey: "myRatingAsc" },
  { value: "movie-rating-desc", labelKey: "filmRatingDesc" },
  { value: "movie-rating-asc", labelKey: "filmRatingAsc" },
  { value: "title-asc", labelKey: "titleAsc" },
];

export default function ProfileFilmsTab() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const filter = (searchParams.get("ff") as FilterType) || "all";
  const sortBy = searchParams.get("fs") || DEFAULT_SORT;
  const viewMode = (searchParams.get("fv") as ViewMode) || "grid";
  // Sayfadan ayrılıp geri dönüldüğünde kaldığı yere devam edebilmesi için
  // son görüntülenen sayfa URL'de tutulur; veri artık tek seferde değil
  // sayfa sayfa (ve React Query cache'i üzerinden) getirilir.
  const restorePageParam = Number(searchParams.get("fp")) || 1;

  const [savingMovieId, setSavingMovieId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { openLog, logModal } = useScreeningLogModal();

  const hasRatingParam = filter === "all" ? undefined : filter === "rated";

  const setFilter = (v: FilterType) => {
    const n = new URLSearchParams(searchParams);
    v === "all" ? n.delete("ff") : n.set("ff", v);
    n.delete("fp");
    setSearchParams(n, { replace: true });
  };

  const setSortBy = (v: string) => {
    const n = new URLSearchParams(searchParams);
    v === DEFAULT_SORT ? n.delete("fs") : n.set("fs", v);
    n.delete("fp");
    setSearchParams(n, { replace: true });
  };

  const setViewMode = (v: ViewMode) => {
    const n = new URLSearchParams(searchParams);
    v === "grid" ? n.delete("fv") : n.set("fv", v);
    setSearchParams(n, { replace: true });
  };

  const { data: counts = { all: 0, rated: 0, unrated: 0 } } =
    useWatchedFilmsCounts();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: loadError,
  } = useInfiniteQuery({
    queryKey: ["watched-films", filter, sortBy],
    queryFn: ({ pageParam }) =>
      profileService.getWatchedFilms({
        page: pageParam,
        pageSize: PAGE_SIZE,
        sortBy,
        hasRating: hasRatingParam,
      }),
    initialPageParam: 1,
    getNextPageParam: (last: FilmsPage) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    staleTime: 30_000,
  });

  // İlk yüklemede, kullanıcı daha önce N. sayfaya kadar gezinmişse
  // (fp parametresi) o sayfaya kadar olan sayfaları arka planda getirir.
  // Her sayfa ayrı ayrı cache'lendiği için filtre/sıralama değişmeden
  // geri dönüldüğünde bu adım React Query cache'inden anında karşılanır.
  const restoredRef = useRef(false);
  useEffect(() => {
    restoredRef.current = false;
  }, [filter, sortBy]);

  useEffect(() => {
    if (restoredRef.current || isLoading) return;
    restoredRef.current = true;

    const pagesLoaded = data?.pages.length ?? 0;
    if (pagesLoaded >= restorePageParam) return;

    let cancelled = false;
    (async () => {
      for (let i = pagesLoaded; i < restorePageParam && !cancelled; i++) {
        if (!hasNextPage) break;
        // eslint-disable-next-line no-await-in-loop
        await fetchNextPage();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const entries = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const loadMore = async () => {
    setActionError(null);
    try {
      const result = await fetchNextPage();
      const nextPage = result.data?.pages.length ?? restorePageParam;
      const n = new URLSearchParams(searchParams);
      nextPage > 1 ? n.set("fp", String(nextPage)) : n.delete("fp");
      setSearchParams(n, { replace: true });
    } catch {
      setActionError(t("profile.filmsLoadError"));
    }
  };

  const handleRate = async (movieId: string, value: number) => {
    setSavingMovieId(movieId);
    try {
      await movieService.upsertRating(movieId, value);
      queryClient.setQueryData(
        ["watched-films", filter, sortBy],
        (prev: { pages: FilmsPage[]; pageParams: unknown[] } | undefined) =>
          prev && {
            ...prev,
            pages: prev.pages.map((p) => ({
              ...p,
              items: p.items.map((e) =>
                e.movieId === movieId ? { ...e, userRating: value } : e,
              ),
            })),
          },
      );
    } catch {
      setActionError(t("profile.ratingSaveError"));
    } finally {
      setSavingMovieId(null);
    }
  };

  const error = actionError ?? (loadError ? t("profile.filmsLoadError") : null);

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
            aria-busy={isFetchingNextPage}
          >
            {entries.map((entry) => (
              <MovieCard
                key={entry.movieId}
                movie={entry.movie}
                userRating={entry.userRating}
                onRate={(value) => handleRate(entry.movieId, value)}
                isRatingSaving={savingMovieId === entry.movieId}
                onLogClick={() => openLog(entry.movie)}
              />
            ))}
            {isFetchingNextPage &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={`more-${i}`} className="film-skeleton" />
              ))}
          </div>

          {hasNextPage && (
            <div className="load-more-wrap">
              <button
                type="button"
                className="load-more-btn btn-secondary"
                onClick={loadMore}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage
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
      {logModal}
    </div>
  );
}
