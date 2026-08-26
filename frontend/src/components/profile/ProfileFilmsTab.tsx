import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const filter = (searchParams.get("ff") as FilterType) || "all";
  const sortBy = searchParams.get("fs") || "watched-desc";
  const viewMode = (searchParams.get("fv") as ViewMode) || "grid";
  const lastPageParam = Number(searchParams.get("fp")) || 1;

  const [savingMovieId, setSavingMovieId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasRatingParam = filter === "all" ? undefined : filter === "rated";

  const setFilter = (v: FilterType) => {
    const n = new URLSearchParams(searchParams);
    v === "all" ? n.delete("ff") : n.set("ff", v);
    n.delete("fp");
    setSearchParams(n, { replace: true });
  };

  const setSortBy = (v: string) => {
    const n = new URLSearchParams(searchParams);
    v === "watched-desc" ? n.delete("fs") : n.set("fs", v);
    n.delete("fp");
    setSearchParams(n, { replace: true });
  };

  const setViewMode = (v: ViewMode) => {
    const n = new URLSearchParams(searchParams);
    v === "grid" ? n.delete("fv") : n.set("fv", v);
    setSearchParams(n, { replace: true });
  };

  // Sayaçlar: filtreden bağımsız, sadece kendi verisi değişince (mutation
  // sonrası invalidate ile) tazelenir — entries'e bağlı değil, bu yüzden
  // "daha fazla yükle" veya silme her tetiklenişinde tekrar çekilmez.
  const { data: counts = { all: 0, rated: 0, unrated: 0 } } = useQuery({
    queryKey: ["watched-films-counts"],
    queryFn: async () => {
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
      return {
        all: all.totalCount,
        rated: rated.totalCount,
        unrated: unrated.totalCount,
      };
    },
    staleTime: 60_000,
  });

  // Ana liste: (filter, sortBy, lastPageParam) aynı kaldığı sürece cache'ten
  // anında gelir — Films sekmesine tekrar girmek artık network beklemez.
  const {
    data,
    isLoading,
    isFetching,
    error: loadError,
  } = useQuery({
    queryKey: ["watched-films", filter, sortBy, lastPageParam],
    queryFn: async () => {
      const first = await profileService.getWatchedFilms({
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy,
        hasRating: hasRatingParam,
      });

      const pagesToFetch = Math.min(lastPageParam, first.totalPages);
      let items = first.items;
      let lastResult = first;

      if (pagesToFetch >= 2) {
        // Sıralı await yerine tüm ara sayfalar paralel çekiliyor —
        // önceki sürümde her sayfa bir öncekinin bitmesini bekliyordu.
        const rest = await Promise.all(
          Array.from({ length: pagesToFetch - 1 }, (_, i) =>
            profileService.getWatchedFilms({
              page: i + 2,
              pageSize: PAGE_SIZE,
              sortBy,
              hasRating: hasRatingParam,
            }),
          ),
        );
        for (const r of rest) items = [...items, ...r.items];
        lastResult = rest[rest.length - 1] ?? first;
      }

      return {
        items,
        page: lastResult.page,
        totalPages: lastResult.totalPages,
      };
    },
    staleTime: 30_000,
  });

  const entries = data?.items ?? [];
  const page = data?.page ?? 1;
  const totalPages = data?.totalPages ?? 1;

  const loadMore = async () => {
    setActionError(null);
    try {
      const result = await profileService.getWatchedFilms({
        page: page + 1,
        pageSize: PAGE_SIZE,
        sortBy,
        hasRating: hasRatingParam,
      });

      queryClient.setQueryData(
        ["watched-films", filter, sortBy, lastPageParam],
        (
          prev:
            | { items: WatchedMovie[]; page: number; totalPages: number }
            | undefined,
        ) => ({
          items: [...(prev?.items ?? entries), ...result.items],
          page: result.page,
          totalPages: result.totalPages,
        }),
      );

      const n = new URLSearchParams(searchParams);
      result.page > 1 ? n.set("fp", String(result.page)) : n.delete("fp");
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
        ["watched-films", filter, sortBy, lastPageParam],
        (
          prev:
            | { items: WatchedMovie[]; page: number; totalPages: number }
            | undefined,
        ) =>
          prev && {
            ...prev,
            items: prev.items.map((e) =>
              e.movieId === movieId ? { ...e, userRating: value } : e,
            ),
          },
      );
    } catch {
      setActionError(t("profile.ratingSaveError"));
    } finally {
      setSavingMovieId(null);
    }
  };

  const handleDelete = async (movieId: string) => {
    setSavingMovieId(movieId);
    try {
      await profileService.removeWatchedFilm(movieId);
      queryClient.setQueryData(
        ["watched-films", filter, sortBy, lastPageParam],
        (
          prev:
            | { items: WatchedMovie[]; page: number; totalPages: number }
            | undefined,
        ) =>
          prev && {
            ...prev,
            items: prev.items.filter((e) => e.movieId !== movieId),
          },
      );
      queryClient.invalidateQueries({ queryKey: ["watched-films-counts"] });
    } catch {
      setActionError(t("profile.removeError"));
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
                onClick={loadMore}
                disabled={isFetching}
              >
                {isFetching ? t("profile.loadingMore") : t("profile.loadMore")}
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
