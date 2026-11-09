import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useCompatibility } from "@/hooks/useCompatibility";
import { useAppSelector } from "@/store/index";
import "./CompatibilityCard.css";

interface CompatibilityCardProps {
  userId: string;
  isOwnProfile: boolean;
}

export default function CompatibilityCard({
  userId,
  isOwnProfile,
}: CompatibilityCardProps) {
  const { t } = useTranslation();
  const viewerId = useAppSelector((s) => s.auth.userId);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  // Misafir (ya da oturum henüz doğrulanmadı) ve kendi profili: istek yok, kart yok.
  const enabled = isAuthenticated && !isOwnProfile;
  const { data, isError } = useCompatibility(userId, viewerId, enabled);

  if (!enabled || isError) return null;

  // Yüklenirken sayfa zıplamasın diye aynı yükseklikte iskelet.
  if (!data) {
    return (
      <div className="compat-card compat-card--skeleton" aria-hidden="true" />
    );
  }

  // Yeterli ortak film yok
  if (data.score === null) {
    const percent = Math.min(
      100,
      Math.round((data.commonCount / data.minRequired) * 100),
    );

    return (
      <div className="compat-card">
        <div className="compat-card__icon">
          <Sparkles size={18} />
        </div>
        <div className="compat-card__body">
          <p className="compat-card__title">
            {t("compatibility.notEnoughTitle")}
          </p>
          <div
            className="compat-card__bar"
            role="progressbar"
            aria-label={t("compatibility.title")}
            aria-valuemin={0}
            aria-valuemax={data.minRequired}
            aria-valuenow={data.commonCount}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="compat-card__sub">
            {t("compatibility.notEnoughProgress", {
              current: data.commonCount,
              required: data.minRequired,
            })}
          </p>
        </div>
      </div>
    );
  }

  // Skor var
  return (
    <div className="compat-card">
      <div
        className="compat-card__ring"
        role="progressbar"
        aria-label={t("compatibility.title")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={data.score}
      >
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle className="compat-card__ring-track" cx="36" cy="36" r="30" />
          <circle
            className="compat-card__ring-fill"
            cx="36"
            cy="36"
            r="30"
            pathLength={100}
            strokeDashoffset={100 - data.score}
          />
        </svg>
        <span className="compat-card__ring-value">
          {t("compatibility.percent", { value: data.score })}
        </span>
      </div>
      <div className="compat-card__body">
        <p className="compat-card__title">{t("compatibility.title")}</p>
        <p className="compat-card__sub">
          {t("compatibility.basedOn", { count: data.commonCount })}
        </p>
      </div>
    </div>
  );
}
