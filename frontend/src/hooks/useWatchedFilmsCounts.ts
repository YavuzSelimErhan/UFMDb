import { useQuery } from "@tanstack/react-query";
import { profileService } from "@/services";

export function useWatchedFilmsCounts() {
  return useQuery({
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
}
