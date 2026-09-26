import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Film } from "lucide-react";
import { EmptyState } from "@/components/common/PageState";
import "./FilmsTab.css";

export type ViewMode = "grid" | "masonry";

interface FilmsGridProps<T> {
  entries: T[];
  getKey: (entry: T) => string;
  renderCard: (entry: T) => ReactNode;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  /** Kaç sayfa şu an cache'te yüklü. > 1 ve onShowLess verilmişse
   *  "Daha az göster" butonu görünür. */
  loadedPages?: number;
  /** Verilirse ve loadedPages > 1 ise, sayfaları ilk sayfaya kırpan bir
   *  "Daha az göster" butonu render edilir. */
  onShowLess?: () => void;
  viewMode?: ViewMode;
  /** Arka planda yeni sonuç yüklenirken mevcut grid'i hafifçe soluklaştırır
   *  (ör. filtre/sıralama değişimi + keepPreviousData). */
  dimmed?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  skeletonCount?: number;
}

/**
 * FilmsTab (kendi profil + başka kullanıcı profili) tarafından paylaşılan izlenen-filmler
 * grid'i: yükleme iskeleti, kart listesi, "Daha fazla yükle" / "Daha az
 * göster" ile isteğe bağlı sayfalama ve boş durum. Bilinçli olarak
 * otomatik (IntersectionObserver ile kaydırınca kendi kendine yükleyen)
 * bir sistem KULLANMIYORUZ: çok sayıda filmi olan bir kullanıcı footer'a
 * hiç ulaşamayabilir ve sürekli arka planda veri çekilmesi istenmiyor.
 * Kart içeriği tamamen `renderCard` ile dışarıdan verildiği için hem
 * kendi profilindeki (puanlanabilir) hem başka kullanıcı profilindeki
 * (salt okunur) kartlarla çalışır.
 */
export default function FilmsGrid<T>({
  entries,
  getKey,
  renderCard,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  loadedPages = 1,
  onShowLess,
  viewMode = "grid",
  dimmed = false,
  emptyTitle,
  emptyHint,
  skeletonCount = 12,
}: FilmsGridProps<T>) {
  const { t } = useTranslation();

  // Yeni film eklendiğinde ekran okuyuculara toplam sayıyı duyurur.
  const announceRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(entries.length);
  useEffect(() => {
    if (entries.length !== prevCountRef.current && announceRef.current) {
      announceRef.current.textContent = t("profile.filmsLoadedCount", {
        count: entries.length,
      });
    }
    prevCountRef.current = entries.length;
  }, [entries.length, t]);

  if (isLoading) {
    return (
      <div className="movie-grid movie-grid--6">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="film-skeleton" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Film size={26} />}
        title={emptyTitle ?? t("profile.noFilmsForFilter")}
        hint={emptyHint}
      />
    );
  }

  const canShowLess = !!onShowLess && loadedPages > 1;

  return (
    <div className={`films-grid${dimmed ? " films-grid--dimmed" : ""}`}>
      <div
        className={`movie-grid movie-grid--6${viewMode === "masonry" ? " movie-grid-masonry" : ""}`}
        aria-busy={isFetchingNextPage}
      >
        {entries.map((entry) => (
          <div className="film-card-cv" key={getKey(entry)}>
            {renderCard(entry)}
          </div>
        ))}
        {isFetchingNextPage &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={`more-${i}`} className="film-skeleton" />
          ))}
      </div>

      <div className="sr-only" aria-live="polite" ref={announceRef} />

      {(hasNextPage || canShowLess) && (
        <div className="load-more-wrap load-more-wrap--actions">
          {hasNextPage && (
            <button
              type="button"
              className="load-more-btn btn-secondary"
              onClick={onLoadMore}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage
                ? t("profile.loadingMore")
                : t("profile.loadMore")}
            </button>
          )}
          {canShowLess && (
            <button
              type="button"
              className="show-less-btn"
              onClick={onShowLess}
              disabled={isFetchingNextPage}
            >
              {t("profile.showLess")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
