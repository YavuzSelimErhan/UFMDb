import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { profileService, movieService } from "@/services";
import MovieCard from "@/components/movie/MovieCard";
import FilmsToolbar, {
  type FilterType,
  type ViewMode,
} from "@/components/profile/FilmsToolbar";
import FilmsGrid from "@/components/profile/FilmsGrid";
import { useWatchedFilmsCounts } from "@/hooks/useWatchedFilmsCounts";
import { useScreeningLogModal } from "@/hooks/useScreeningLogModal";
import type { WatchedMovie } from "@/types";
import "./ProfileFilmsTab.css";

const PAGE_SIZE = 24;
const DEFAULT_SORT = "release-desc";

type FilmsPage = { items: WatchedMovie[]; page: number; totalPages: number };
type FilmsCache = { pages: FilmsPage[]; pageParams: unknown[] };

// "fp" (kaçıncı sayfaya kadar yüklendiği) sadece "sayfadan ayrılıp geri
// dönünce kaldığı yerden devam etsin" için URL'de tutuluyor. Bunu
// setSearchParams (React Router navigasyonu) yerine doğrudan
// history.replaceState ile güncelliyoruz. Neden: bir "Daha fazla yükle"
// tıklamasını router navigasyonu olarak işaretlemek, uygulamada varsa
// global bir scroll-restorasyon/`ScrollToTop` davranışını tetikleyip
// sayfayı en üste zıplatabiliyor — preventScrollReset her kurulumda bunu
// engellemeyebiliyor. history.replaceState hiçbir navigasyon event'i
// tetiklemediği için bu sorunu kökten çözüyor; filtre/sıralama/görünüm
// değişiklikleri hâlâ normal setSearchParams ile, router üzerinden gider.
function readFpFromUrl(): number {
  return Number(new URLSearchParams(window.location.search).get("fp")) || 1;
}

function writeFpToUrl(page: number) {
  const url = new URL(window.location.href);
  page > 1
    ? url.searchParams.set("fp", String(page))
    : url.searchParams.delete("fp");
  window.history.replaceState(window.history.state, "", url);
}

export default function ProfileFilmsTab() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const filter = (searchParams.get("ff") as FilterType) || "all";
  const sortBy = searchParams.get("fs") || DEFAULT_SORT;
  const viewMode = (searchParams.get("fv") as ViewMode) || "grid";

  // Sadece ilk mount'ta okunur; sonrasında pagination bookkeeping'i
  // router'dan bağımsız olarak writeFpToUrl ile yürütülür.
  const [restorePageParam] = useState(readFpFromUrl);

  const [savingMovieId, setSavingMovieId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { openLog, logModal } = useScreeningLogModal();
  const topRef = useRef<HTMLDivElement | null>(null);

  const hasRatingParam = filter === "all" ? undefined : filter === "rated";

  const setFilter = (v: FilterType) => {
    const n = new URLSearchParams(window.location.search);
    v === "all" ? n.delete("ff") : n.set("ff", v);
    n.delete("fp");
    setSearchParams(n, { replace: true });
  };

  const setSortBy = (v: string) => {
    const n = new URLSearchParams(window.location.search);
    v === DEFAULT_SORT ? n.delete("fs") : n.set("fs", v);
    n.delete("fp");
    setSearchParams(n, { replace: true });
  };

  const setViewMode = (v: ViewMode) => {
    const n = new URLSearchParams(window.location.search);
    // fp bilerek dokunulmuyor: görünüm değişse de kaldığı sayfa korunur.
    v === "grid" ? n.delete("fv") : n.set("fv", v);
    setSearchParams(n, { replace: true });
  };

  const { data: counts = { all: 0, rated: 0, unrated: 0 } } =
    useWatchedFilmsCounts();

  const {
    data,
    isLoading,
    isFetching,
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
    placeholderData: keepPreviousData,
  });

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
  const loadedPages = data?.pages.length ?? 1;

  const loadMore = async () => {
    setActionError(null);
    try {
      const result = await fetchNextPage();
      const nextPage = result.data?.pages.length ?? restorePageParam;
      writeFpToUrl(nextPage);
    } catch {
      setActionError(t("profile.filmsLoadError"));
    }
  };

  // Açılmış sayfaları tek sayfaya kırpar ve toolbar'a geri kaydırır —
  // "sürekli genişleyip hiç küçülmüyor" sorununu çözer.
  const showLess = () => {
    queryClient.setQueryData(
      ["watched-films", filter, sortBy],
      (prev: FilmsCache | undefined) =>
        prev && {
          pages: prev.pages.slice(0, 1),
          pageParams: prev.pageParams.slice(0, 1),
        },
    );
    writeFpToUrl(1);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRate = async (movieId: string, value: number) => {
    setSavingMovieId(movieId);
    try {
      await movieService.upsertRating(movieId, value);
      queryClient.setQueryData(
        ["watched-films", filter, sortBy],
        (prev: FilmsCache | undefined) =>
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
      <div ref={topRef}>
        <FilmsToolbar
          filter={filter}
          onFilterChange={setFilter}
          counts={counts}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {error && <p className="films-error">{error}</p>}

      <FilmsGrid
        entries={entries}
        getKey={(entry) => entry.movieId}
        renderCard={(entry) => (
          <MovieCard
            movie={entry.movie}
            userRating={entry.userRating}
            onRate={(value) => handleRate(entry.movieId, value)}
            isRatingSaving={savingMovieId === entry.movieId}
            onLogClick={() => openLog(entry.movie)}
          />
        )}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={!!hasNextPage}
        onLoadMore={loadMore}
        loadedPages={loadedPages}
        onShowLess={loadedPages > 1 ? showLess : undefined}
        viewMode={viewMode}
        dimmed={isFetching && !isFetchingNextPage && !isLoading}
      />

      {logModal}
    </div>
  );
}
