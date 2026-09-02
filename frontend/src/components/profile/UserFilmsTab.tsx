import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { followService } from "@/services";
import MovieCard from "@/components/movie/MovieCard";
import { EmptyState } from "@/components/common/PageState";
import type { WatchedMovie } from "@/types";
import "./ProfileFilmsTab.css";

const PAGE_SIZE = 24;

export default function UserFilmsTab({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<WatchedMovie[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetching, setIsFetching] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["user-watched-films", userId],
    queryFn: async () => {
      const result = await followService.getWatchedFilms(userId, {
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setEntries(result.items);
      setTotalPages(result.totalPages);
      setPage(1);
      return result;
    },
    staleTime: 30_000,
  });

  const loadMore = async () => {
    setIsFetching(true);
    try {
      const result = await followService.getWatchedFilms(userId, {
        page: page + 1,
        pageSize: PAGE_SIZE,
      });
      setEntries((prev) => [...prev, ...result.items]);
      setPage(result.page);
      setTotalPages(result.totalPages);
    } finally {
      setIsFetching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="movie-grid movie-grid--6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="film-skeleton" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState icon={<Film size={26} />} title={t("profile.emptyContent")} />
    );
  }

  return (
    <div className="films-tab">
      <div className="movie-grid movie-grid--6">
        {entries.map((entry) => (
          <MovieCard
            key={entry.movieId}
            movie={entry.movie}
            userRating={entry.userRating}
            subtitle={new Date(entry.watchedAtUtc).toLocaleDateString(
              i18n.language,
              {
                day: "numeric",
                month: "short",
                year: "numeric",
              },
            )}
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
    </div>
  );
}
