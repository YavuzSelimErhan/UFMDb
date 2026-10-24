import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

/**
 * Arayüz dili değişince tüm React Query önbelleğini geçersiz kılar.
 *
 * Backend film başlığı/özet/tür/ülke adlarını Accept-Language başlığına göre lokalize ediyor,
 * ama sorgu anahtarlarında dil olmadığı için React Query dil değişince veriyi yeniden çekmiyordu
 * (sadece F5 sonrası düzeliyordu). Bu hook, QueryClientProvider'ın içinde bir yerde (App veya
 * ana layout) TEK SEFER çağrılmalıdır.
 *
 * - Ekranda açık (aktif) sorgular hemen yeniden çekilir.
 * - Açık olmayanlar "stale" işaretlenir, bir sonraki kullanımda taze veriyle gelir.
 * - Önceki dil bir ref'te tutulduğu için ilk render'da ve React StrictMode'un çift effect
 *   çalıştırmasında gereksiz invalidate yapılmaz.
 */
export function useRefetchOnLanguageChange() {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const previousLanguage = useRef(language);

  useEffect(() => {
    if (previousLanguage.current === language) return;
    previousLanguage.current = language;
    queryClient.invalidateQueries();
  }, [language, queryClient]);
}
