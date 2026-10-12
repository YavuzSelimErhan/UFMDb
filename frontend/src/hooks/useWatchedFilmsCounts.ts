import { useQuery } from "@tanstack/react-query";
import { profileService, followService } from "@/services";
import type { WatchedFilmsCounts } from "@/types";

export const watchedCountsKey = (userId?: string) =>
  ["watched-films-counts", userId ?? "me"] as const;

export function useWatchedFilmsCounts(userId?: string) {
  return useQuery<WatchedFilmsCounts>({
    queryKey: watchedCountsKey(userId),
    queryFn: () =>
      userId
        ? followService.getWatchedFilmCounts(userId)
        : profileService.getWatchedFilmCounts(),
    staleTime: 60_000,
  });
}
