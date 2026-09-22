import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery } from "@tanstack/react-query";
import { followService } from "@/services";
import MovieCard from "@/components/movie/MovieCard";
import FilmsGrid from "@/components/profile/FilmsGrid";
import { PageError } from "@/components/common/PageState";
import type { WatchedMovie } from "@/types";
import "./ProfileFilmsTab.css";

const PAGE_SIZE = 24;

type FilmsPage = { items: WatchedMovie[]; page: number; totalPages: number };

/**
 * Başka bir kullanıcının izlediği filmler listesi. ProfileFilmsTab'daki
 * filtre/sıralama araç çubuğu yok (bu bir başkasının profili), ama
 * sayfalama, iskelet yükleme, boş durum ve artık hata yönetimi de dahil
 * olmak üzere aynı FilmsGrid altyapısını paylaşıyor.
 */
export default function UserFilmsTab({ userId }: { userId: string }) {
  const { t } = useTranslation();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["user-watched-films", userId],
    queryFn: ({ pageParam }) =>
      followService.getWatchedFilms(userId, {
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last: FilmsPage) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    staleTime: 30_000,
  });

  const entries = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  // Önceki sürümde hata yönetimi hiç yoktu (fetch başarısız olursa sessizce
  // takılı kalıyordu). Artık diğer sekmelerle tutarlı bir hata + yeniden
  // deneme ekranı gösteriyor.
  if (isError) {
    return (
      <PageError
        message={t("errors.userFilmsFailed")}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="films-tab">
      <FilmsGrid
        entries={entries}
        getKey={(entry) => entry.movieId}
        renderCard={(entry) => (
          <MovieCard
            movie={entry.movie}
            userRating={entry.userRating}
            interactive={false}
          />
        )}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={!!hasNextPage}
        onLoadMore={() => fetchNextPage()}
        emptyTitle={t("profile.emptyContent")}
      />
    </div>
  );
}
