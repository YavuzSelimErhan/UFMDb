import { useQuery } from "@tanstack/react-query";
import { profileService, followService } from "@/services";
import type { WatchedFilmsCounts } from "@/types";

/** Tek anahtar: ProfileHeader profil verisiyle bu cache'i seed eder, FilmsTab ve sekme rozeti okur. */
export const watchedCountsKey = (userId?: string) =>
  ["watched-films-counts", userId ?? "me"] as const;

/**
 * userId verilmezse: giriş yapmış kullanıcının kendi sayıları (profileService).
 * Verilirse: o kullanıcının sayıları (followService).
 */
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
