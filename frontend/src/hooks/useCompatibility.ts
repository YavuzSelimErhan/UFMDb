import { useQuery } from "@tanstack/react-query";
import { followService } from "@/services";

/**
 * Giriş yapan kullanıcı ile `targetUserId` arasındaki zevk uyumu.
 * `enabled` false ise (misafir ya da kendi profili) istek hiç atılmaz;
 * misafir isteği 401 → /login yönlendirmesine yol açardı.
 */
export function useCompatibility(
  targetUserId: string | undefined,
  viewerId: string | null,
  enabled: boolean,
) {
  return useQuery({
    // viewerId anahtarda: hesap değişince önceki kullanıcının skoru görünmez
    queryKey: ["compatibility", viewerId, targetUserId],
    queryFn: () => followService.getCompatibility(targetUserId!),
    enabled: enabled && !!targetUserId,
    staleTime: 60_000,
  });
}
