import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Sparkles } from "lucide-react";
import { useAppSelector } from "@/store/index"; // typed hook'unun gerçek yoluna göre düzelt
import { getImageUrl } from "@/utils/getImageUrl";
import { useCompatibility } from "@/hooks/useCompatibility";
import CompatibilityRing from "./CompatibilityRing";
import CompatibilityModal from "./CompatibilityModal";
import "./CompatibilityBadge.css";

interface CompatibilityBadgeProps {
  userId: string;
  userName: string;
  /** Opsiyonel profil resmi; modal başlığında ve kart görünümünde gösterilir. */
  avatarUrl?: string | null;
  /**
   * "pill": eski yuvarlak rozet. "card": vurgu kartı.
   * "action": profil header'ının sağ üstündeki kompakt buton (stilleri ProfileHeader.css'te).
   */
  variant?: "pill" | "card" | "action";
}

export default function CompatibilityBadge({
  userId,
  userName,
  avatarUrl,
  variant = "pill",
}: CompatibilityBadgeProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const viewerId = useAppSelector((s) => s.auth.userId);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  // Oturum doğrulanmadan ya da kendi profilinde istek atılmaz (401 → /login riski).
  const enabled = isAuthenticated && viewerId !== userId;
  const { data, isError } = useCompatibility(userId, viewerId, enabled);

  if (!enabled || isError) return null;

  const isCard = variant === "card";
  const isAction = variant === "action";
  const rootClass = `compat-badge${isCard ? " compat-badge--card" : ""}`;

  if (!data) {
    return (
      <div
        className={
          isAction
            ? "profile-header__btn profile-header__btn--skeleton"
            : `${rootClass} compat-badge--skeleton`
        }
        aria-hidden="true"
      />
    );
  }

  const hasScore = data.score !== null;
  // Ortak film varsa detay açılır; yoksa gösterilecek bir şey olmadığı için rozet statik kalır.
  const interactive = data.commonCount > 0;

  const ariaLabel = hasScore
    ? t("compatibility.badgeAria", {
        score: data.score,
        count: data.commonCount,
      })
    : t("compatibility.badgePendingAria", {
        current: data.commonCount,
        required: data.minRequired,
      });

  const modal = open && (
    <CompatibilityModal
      userId={userId}
      userName={userName}
      avatarUrl={avatarUrl}
      viewerId={viewerId}
      compat={data}
      onClose={() => setOpen(false)}
    />
  );

  // ---------- Header butonu ----------
  if (isAction) {
    const actionContent = (
      <>
        <Sparkles size={14} aria-hidden="true" />
        <span>
          {hasScore
            ? t("compatibility.percent", { value: data.score })
            : `${data.commonCount}/${data.minRequired}`}
        </span>
        <span className="profile-header__btn-label">
          {t("compatibility.title")}
        </span>
      </>
    );

    if (!interactive) {
      return (
        <div
          className="profile-header__btn profile-header__btn--compat is-static"
          aria-label={ariaLabel}
        >
          {actionContent}
        </div>
      );
    }

    return (
      <>
        <button
          type="button"
          className="profile-header__btn profile-header__btn--compat"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={ariaLabel}
        >
          {actionContent}
        </button>
        {modal}
      </>
    );
  }

  // ---------- pill / card (değişmedi) ----------
  const subText = hasScore
    ? t("compatibility.commonFilms", { count: data.commonCount })
    : t("compatibility.notEnoughProgress", {
        current: data.commonCount,
        required: data.minRequired,
      });

  const content = isCard ? (
    <>
      {hasScore ? (
        <span className="compat-badge__circles" aria-hidden="true">
          <span className="compat-badge__circle compat-badge__circle--you">
            {t("compatibility.youLabel")}
          </span>
          <span className="compat-badge__circle">
            {avatarUrl ? (
              <img src={getImageUrl(avatarUrl)} alt="" />
            ) : (
              userName[0]?.toUpperCase()
            )}
          </span>
        </span>
      ) : (
        <span className="compat-badge__icon">
          <Sparkles size={18} />
        </span>
      )}
      <span className="compat-badge__text">
        <span className="compat-badge__title compat-badge__title--score">
          {hasScore
            ? `${t("compatibility.percent", { value: data.score })} ${t("compatibility.title")}`
            : t("compatibility.notEnoughTitle")}
        </span>
        <span className="compat-badge__sub">{subText}</span>
      </span>
      {interactive && (
        <span className="compat-badge__cta">
          <span className="compat-badge__cta-label">
            {t("compatibility.details", { defaultValue: "Details" })}
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      )}
    </>
  ) : (
    <>
      {hasScore ? (
        <CompatibilityRing score={data.score!} size={44} />
      ) : (
        <span className="compat-badge__icon">
          <Sparkles size={18} />
        </span>
      )}
      <span className="compat-badge__text">
        <span className="compat-badge__title">
          {hasScore
            ? t("compatibility.title")
            : t("compatibility.notEnoughTitle")}
        </span>
        <span className="compat-badge__sub">{subText}</span>
      </span>
      {interactive && (
        <ChevronRight
          size={18}
          aria-hidden="true"
          className="compat-badge__chevron"
        />
      )}
    </>
  );

  if (!interactive) return <div className={rootClass}>{content}</div>;

  return (
    <>
      <button
        type="button"
        className={rootClass}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
      >
        {content}
      </button>
      {modal}
    </>
  );
}
