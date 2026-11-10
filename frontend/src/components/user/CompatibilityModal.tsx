import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, Info, Sparkles, X } from "lucide-react";
import StarRating from "@/components/movie/StarRating";
import { PageSpinner, PageError } from "@/components/common/PageState";
import { useCompatibilityFilms } from "@/hooks/useCompatibilityFilms";
import type { CompatibilityFilm, CompatibilityResult } from "@/types";
import CompatibilityRing from "./CompatibilityRing";
import "./CompatibilityModal.css";

const LOW_CONFIDENCE_FILMS = 20;

interface CompatibilityModalProps {
  userId: string;
  userName: string;
  viewerId: string | null;
  compat: CompatibilityResult;
  onClose: () => void;
}

function RatingLine({
  label,
  who,
  value,
}: {
  label: string;
  who: string;
  value: number;
}) {
  const { t, i18n } = useTranslation();
  const formatted = value.toLocaleString(i18n.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div
      className="compat-modal__rating"
      role="img"
      aria-label={t("compatibility.ratedBy", { who, value: formatted })}
    >
      <span
        className="compat-modal__rating-label"
        aria-hidden="true"
        title={who}
      >
        {label}
      </span>
      <StarRating value={value} readOnly size={12} />
      <span className="compat-modal__rating-value" aria-hidden="true">
        {formatted}
      </span>
    </div>
  );
}

function FilmRow({
  film,
  userName,
  variant,
  onNavigate,
}: {
  film: CompatibilityFilm;
  userName: string;
  variant: "agree" | "disagree";
  onNavigate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const diff = film.difference.toLocaleString(i18n.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const apart =
    film.difference === 0
      ? t("compatibility.sameRating")
      : t("compatibility.apart", { value: diff });

  return (
    <li className="compat-modal__film">
      <div className="compat-modal__film-top">
        <Link
          to={`/movies/${film.movieId}`}
          className="compat-modal__film-link"
          onClick={onNavigate}
        >
          {film.posterUrl ? (
            <img
              className="compat-modal__poster"
              src={film.posterUrl}
              alt=""
              loading="lazy"
            />
          ) : (
            <span className="compat-modal__poster" aria-hidden="true" />
          )}
          <span className="compat-modal__film-info">
            <span className="compat-modal__film-meta">{film.releaseYear}</span>
            <span className="compat-modal__film-title">{film.title}</span>
          </span>
        </Link>
        <span
          className={`compat-modal__delta compat-modal__delta--${variant}`}
          aria-label={apart}
          title={apart}
        >
          Δ {diff}
        </span>
      </div>
      <div className="compat-modal__ratings">
        <RatingLine
          label={t("compatibility.youLabel")}
          who={t("compatibility.youLabel")}
          value={film.myRating}
        />
        <RatingLine label={userName} who={userName} value={film.theirRating} />
      </div>
    </li>
  );
}

export default function CompatibilityModal({
  userId,
  userName,
  viewerId,
  compat,
  onClose,
}: CompatibilityModalProps) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch } = useCompatibilityFilms(
    userId,
    viewerId,
    true,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasScore = compat.score !== null;
  const hasHighlights =
    !!data && (data.agreements.length > 0 || data.disagreements.length > 0);

  return (
    <div className="compat-modal__backdrop" onClick={onClose}>
      <div
        className="compat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compat-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="compat-modal__accent" aria-hidden="true" />
        <div className="compat-modal__handle" aria-hidden="true">
          <span />
        </div>

        <div className="compat-modal__header">
          <h3 id="compat-modal-title">
            {t("compatibility.modalTitle", { name: userName })}
          </h3>
          <button
            type="button"
            className="compat-modal__close"
            onClick={onClose}
            aria-label={t("compatibility.close")}
            autoFocus
          >
            <X size={18} />
          </button>
        </div>

        <div className="compat-modal__body">
          {/* SOL PANEL: skor özeti */}
          <aside className="compat-modal__side">
            <div className="compat-modal__summary">
              {hasScore ? (
                <CompatibilityRing score={compat.score!} />
              ) : (
                <div className="compat-modal__icon">
                  <Sparkles size={22} />
                </div>
              )}
              <div>
                <p className="compat-modal__summary-title">
                  {hasScore
                    ? t("compatibility.commonFilms", {
                        count: compat.commonCount,
                      })
                    : t("compatibility.notEnoughTitle")}
                </p>
                <p className="compat-modal__summary-sub">
                  {hasScore
                    ? data?.averageDifference != null &&
                      t("compatibility.averageGap", {
                        value: data.averageDifference.toLocaleString(
                          i18n.language,
                          {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          },
                        ),
                      })
                    : t("compatibility.notEnoughProgress", {
                        current: compat.commonCount,
                        required: compat.minRequired,
                      })}
                </p>
              </div>
            </div>

            {hasScore && compat.commonCount < LOW_CONFIDENCE_FILMS && (
              <p className="compat-modal__summary-note">
                <Info size={16} aria-hidden="true" />
                <span>{t("compatibility.lowConfidence")}</span>
              </p>
            )}

            <details className="compat-modal__how">
              <summary>
                <Info size={16} aria-hidden="true" />
                <span>{t("compatibility.howTitle")}</span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className="compat-modal__how-chevron"
                />
              </summary>
              <p>{t("compatibility.howBody", { min: compat.minRequired })}</p>
            </details>
          </aside>

          {/* SAĞ PANEL: filmler */}
          <div className="compat-modal__main">
            {isLoading && <PageSpinner label={t("common.loading")} />}
            {isError && (
              <PageError
                message={t("common.genericError")}
                onRetry={() => refetch()}
              />
            )}
            {data && !hasHighlights && (
              <p className="compat-modal__empty">
                {t("compatibility.noHighlights")}
              </p>
            )}

            {data && data.agreements.length > 0 && (
              <section>
                <div className="compat-modal__section-head">
                  <h4 className="compat-modal__heading compat-modal__heading--agree">
                    {t("compatibility.agreements")}
                  </h4>
                  <span className="compat-modal__badge compat-modal__badge--agree">
                    Δ ≤ 0.5
                  </span>
                </div>
                <ul className="compat-modal__list">
                  {data.agreements.map((f) => (
                    <FilmRow
                      key={f.movieId}
                      film={f}
                      userName={userName}
                      variant="agree"
                      onNavigate={onClose}
                    />
                  ))}
                </ul>
              </section>
            )}

            {data && data.disagreements.length > 0 && (
              <section>
                <div className="compat-modal__section-head">
                  <h4 className="compat-modal__heading compat-modal__heading--disagree">
                    {t("compatibility.disagreements")}
                  </h4>
                  <span className="compat-modal__badge compat-modal__badge--disagree">
                    Δ ≥ 1.5
                  </span>
                </div>
                <ul className="compat-modal__list">
                  {data.disagreements.map((f) => (
                    <FilmRow
                      key={f.movieId}
                      film={f}
                      userName={userName}
                      variant="disagree"
                      onNavigate={onClose}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
