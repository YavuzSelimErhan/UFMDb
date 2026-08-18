import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "./PageState.css";

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="page-spinner">
      <div className="page-spinner__ring" />
      {label && <p className="text-muted">{label}</p>}
    </div>
  );
}

export function PageError({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="page-error">
      <AlertTriangle size={32} />
      <p>{message ?? t("common.genericError")}</p>
      {onRetry && (
        <button className="btn-secondary page-error__retry" onClick={onRetry}>
          <RefreshCw size={15} /> {t("common.retry")}
        </button>
      )}
    </div>
  );
}

/** Kart grid'i için iskelet (skeleton) yükleme animasyonu */
export function MovieGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="movie-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-card__poster shimmer" />
          <div className="skeleton-card__line shimmer" />
          <div className="skeleton-card__line shimmer short" />
        </div>
      ))}
    </div>
  );
}

export function RailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="rail-skeleton">
      <div className="rail-skeleton__eyebrow shimmer" />
      <div className="rail-skeleton__title shimmer" />
      <div className="rail-skeleton__track">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-card rail-skeleton__card">
            <div className="skeleton-card__poster shimmer" />
            <div className="skeleton-card__line shimmer" />
            <div className="skeleton-card__line shimmer short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon">{icon}</div>}
      <p className="empty-state__title">{title}</p>
      {hint && <p className="empty-state__hint text-muted">{hint}</p>}
    </div>
  );
}
