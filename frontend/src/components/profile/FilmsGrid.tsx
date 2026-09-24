import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Film } from "lucide-react";
import { EmptyState } from "@/components/common/PageState";
import "./ProfileFilmsTab.css";

export type ViewMode = "grid" | "masonry";

interface FilmsGridProps<T> {
  entries: T[];
  getKey: (entry: T) => string;
  renderCard: (entry: T) => ReactNode;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  viewMode?: ViewMode;
  /** Arka planda yeni sonuç yüklenirken mevcut grid'i hafifçe soluklaştırır
   *  (ör. filtre/sıralama değişimi + keepPreviousData). */
  dimmed?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  skeletonCount?: number;
}

/**
 * ProfileFilmsTab ve UserFilmsTab arasında paylaşılan izlenen-filmler
 * grid'i: yükleme iskeleti, kart listesi, "Daha fazla yükle" butonuyla
 * isteğe bağlı sayfalama ve boş durum. Bilinçli olarak otomatik
 * (IntersectionObserver ile kaydırınca kendi kendine yükleyen) bir sistem
 * KULLANMIYORUZ: çok sayıda filmi olan bir kullanıcı footer'a hiç
 * ulaşamayabilir ve sürekli arka planda veri çekilmesi istenmiyor. Kart
 * içeriği tamamen `renderCard` ile dışarıdan verildiği için hem kendi
 * profilindeki (puanlanabilir) hem başka kullanıcı profilindeki (salt
 * okunur) kartlarla çalışır.
 */
export default function FilmsGrid<T>({
  entries,
  getKey,
  renderCard,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
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

      {hasNextPage && (
        <div className="load-more-wrap">
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
        </div>
      )}
    </div>
  );
}
