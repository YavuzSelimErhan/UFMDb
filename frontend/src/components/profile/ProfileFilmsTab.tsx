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

export default function ProfileFilmsTab() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const filter = (searchParams.get("ff") as FilterType) || "all";
  const sortBy = searchParams.get("fs") || DEFAULT_SORT;
  const viewMode = (searchParams.get("fv") as ViewMode) || "grid";
  // Sayfadan ayrılıp geri dönüldüğünde kaldığı yere devam edebilmesi için
  // son görüntülenen sayfa URL'de tutulur.
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
    // Filtre/sıralama değişince ekran her seferinde boş skeleton'a dönmez;
    // önceki sonuçlar yenisi gelene kadar (hafifçe soluklaşarak) ekranda
    // kalır. Bkz. FilmsGrid `dimmed` prop'u.
    placeholderData: keepPreviousData,
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
      // preventScrollReset: "Daha fazla yükle" sadece mevcut listenin
      // altına yeni film ekler; React Router'ın varsayılan davranışı
      // (search params değişince sayfayı en üste kaydırması) burada
      // istenmiyor — kullanıcı olduğu yerde kalmalı.
      setSearchParams(n, { replace: true, preventScrollReset: true });
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
      <FilmsToolbar
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

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
        viewMode={viewMode}
        dimmed={isFetching && !isFetchingNextPage && !isLoading}
      />

      {logModal}
    </div>
  );
}
