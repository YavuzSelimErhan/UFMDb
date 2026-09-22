import { useEffect, useRef } from "react";

interface Options {
  /** Tetiklendiğinde çağrılacak fonksiyon (ör. fetchNextPage). */
  onIntersect: () => void;
  /** false iken gözlem tamamen devre dışı (ör. hasNextPage yokken). */
  enabled: boolean;
  /** Ekrana girmeden ne kadar önce tetiklensin. */
  rootMargin?: string;
}

/**
 * Sayfanın altına yaklaşıldığında (rootMargin kadar önce) onIntersect'i
 * tetikleyen ince bir IntersectionObserver sarmalayıcısı.
 *
 * Bu sadece bir "progressive enhancement" katmanıdır: "Daha fazla yükle"
 * butonu her zaman ekranda kalmaya devam eder (klavye/erişilebilirlik
 * için), bu hook yalnızca fare/dokunmatik ile kaydıran kullanıcılar için
 * butona tıklama ihtiyacını ortadan kaldırır. IntersectionObserver
 * desteklenmeyen ortamlarda (çok eski tarayıcılar, test ortamları vb.)
 * sessizce hiçbir şey yapmaz ve buton tek yol olarak kalır.
 */
export function useInfiniteScrollSentinel({
  onIntersect,
  enabled,
  rootMargin = "480px",
}: Options) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // onIntersect her render'da yeni bir referans olabilir (inline arrow fn);
  // observer'ı gereksiz yere yeniden kurmamak için ref üzerinden çağırıyoruz.
  const onIntersectRef = useRef(onIntersect);
  useEffect(() => {
    onIntersectRef.current = onIntersect;
  }, [onIntersect]);

  useEffect(() => {
    if (!enabled) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersectRef.current();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
