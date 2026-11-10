import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Sparkles } from "lucide-react";
import { useAppSelector } from "@/store/index"; // typed hook'unun gerçek yoluna göre düzelt
import { useCompatibility } from "@/hooks/useCompatibility";
import CompatibilityRing from "./CompatibilityRing";
import CompatibilityModal from "./CompatibilityModal";
import "./CompatibilityBadge.css";

interface CompatibilityBadgeProps {
  userId: string;
  userName: string;
  /** Opsiyonel profil resmi; modal başlığında gösterilir. */
  avatarUrl?: string | null;
}

export default function CompatibilityBadge({
  userId,
  userName,
  avatarUrl,
}: CompatibilityBadgeProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const viewerId = useAppSelector((s) => s.auth.userId);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  // Oturum doğrulanmadan ya da kendi profilinde istek atılmaz (401 → /login riski).
  const enabled = isAuthenticated && viewerId !== userId;
  const { data, isError } = useCompatibility(userId, viewerId, enabled);

  if (!enabled || isError) return null;

  if (!data) {
    return (
      <div className="compat-badge compat-badge--skeleton" aria-hidden="true" />
    );
  }

  const hasScore = data.score !== null;
  // Ortak film varsa detay açılır; yoksa gösterilecek bir şey olmadığı için rozet statik kalır.
  const interactive = data.commonCount > 0;

  const content = (
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
        <span className="compat-badge__sub">
          {hasScore
            ? t("compatibility.commonFilms", { count: data.commonCount })
            : t("compatibility.notEnoughProgress", {
                current: data.commonCount,
                required: data.minRequired,
              })}
        </span>
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

  if (!interactive) return <div className="compat-badge">{content}</div>;

  return (
    <>
      <button
        type="button"
        className="compat-badge"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={
          hasScore
            ? t("compatibility.badgeAria", {
                score: data.score,
                count: data.commonCount,
              })
            : t("compatibility.badgePendingAria", {
                current: data.commonCount,
                required: data.minRequired,
              })
        }
      >
        {content}
      </button>
      {open && (
        <CompatibilityModal
          userId={userId}
          userName={userName}
          avatarUrl={avatarUrl}
          viewerId={viewerId}
          compat={data}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
