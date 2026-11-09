import { useQuery } from "@tanstack/react-query";
import { followService } from "@/services";

/** Modal açılınca çağrılır; viewerId anahtarda, hesap değişince eski veri görünmesin. */
export function useCompatibilityFilms(
  targetUserId: string | undefined,
  viewerId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["compatibility-films", viewerId, targetUserId],
    queryFn: () => followService.getCompatibilityFilms(targetUserId!),
    enabled: enabled && !!targetUserId,
    staleTime: 60_000,
  });
}
