import { useQuery } from "@tanstack/react-query";
import { profileService, followService } from "@/services";

/**
 * userId verilmezse: giriş yapmış kullanıcının kendi sayıları
 * (profileService). Verilirse: o kullanıcının sayıları (followService) —
 * backend'deki GetUserWatchedMoviesQuery handler'ı zaten userId
 * parametreli ve iki controller'da da (Profile/Follows) aynı şekilde
 * çalışıyor, bu yüzden burada da tek bir mantık yeterli.
 */
export function useWatchedFilmsCounts(userId?: string) {
  return useQuery({
    queryKey: ["watched-films-counts", userId ?? "me"],
    queryFn: async () => {
      const fetchPage = (hasRating?: boolean) =>
        userId
          ? followService.getWatchedFilms(userId, {
              page: 1,
              pageSize: 1,
              hasRating,
            })
          : profileService.getWatchedFilms({ page: 1, pageSize: 1, hasRating });

      const [all, rated, unrated] = await Promise.all([
        fetchPage(undefined),
        fetchPage(true),
        fetchPage(false),
      ]);
      return {
        all: all.totalCount,
        rated: rated.totalCount,
        unrated: unrated.totalCount,
      };
    },
    staleTime: 60_000,
  });
}
