import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Star, X } from "lucide-react";
import type { ProfileData } from "@/types";
import { getImageUrl } from "@/utils/getImageUrl";
import "./ProfileHeader.css";

interface Props {
  profile: ProfileData;
  onEditClick: () => void;
}

export default function ProfileHeader({ profile, onEditClick }: Props) {
  const { t, i18n } = useTranslation();
  const [isAvatarExpanded, setIsAvatarExpanded] = useState(false);

  useEffect(() => {
    if (!isAvatarExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsAvatarExpanded(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAvatarExpanded]);

  const memberSinceDate = profile.memberSinceUtc
    ? new Date(profile.memberSinceUtc)
    : null;
  const memberSince =
    memberSinceDate && !isNaN(memberSinceDate.getTime())
      ? memberSinceDate.toLocaleDateString(
          i18n.language === "tr" ? "tr-TR" : "en-US",
          { month: "long", year: "numeric" },
        )
      : null;

  return (
    <div className="profile-header">
      <div className="profile-header__cover">
        <div className="profile-header__cover-glow" />
        <div className="profile-header__stats">
          <div className="profile-header__stat">
            <p className="profile-header__stat-value">
              {profile.totalWatchedCount ?? 0}
            </p>
            <p className="profile-header__stat-label">
              {t("profile.statFilms")}
            </p>
          </div>
          <div className="profile-header__stat">
            <p className="profile-header__stat-value">
              {profile.reviews.length}
            </p>
            <p className="profile-header__stat-label">
              {t("profile.statReviews")}
            </p>
          </div>
          <div className="profile-header__stat">
            <p className="profile-header__stat-value profile-header__stat-value--accent">
              {profile.averageGivenRating !== null ? (
                <>
                  <Star size={16} fill="currentColor" />{" "}
                  {profile.averageGivenRating.toFixed(1)}
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="profile-header__stat-label">
              {t("profile.statAverage")}
            </p>
          </div>
        </div>
      </div>

      <div className="profile-header__avatar-wrap">
        <button
          type="button"
          className="profile-header__avatar"
          onClick={() => profile.avatarUrl && setIsAvatarExpanded(true)}
          aria-label={t("profile.viewAvatar")}
        >
          {profile.avatarUrl ? (
            <img src={getImageUrl(profile.avatarUrl)} alt={profile.userName} />
          ) : (
            <span>{profile.userName[0]?.toUpperCase()}</span>
          )}
        </button>
      </div>

      <div className="profile-header__body">
        <div>
          <h1 className="profile-header__name">{profile.userName}</h1>
          <p className="profile-header__since">
            {t("profile.member")}
            {memberSince && ` · ${memberSince}`}
          </p>
        </div>
        <button
          className="btn-secondary profile-header__edit-btn"
          onClick={onEditClick}
        >
          <Pencil size={14} /> {t("profile.editProfile")}
        </button>
      </div>

      {isAvatarExpanded && profile.avatarUrl && (
        <div
          className="avatar-lightbox"
          onClick={() => setIsAvatarExpanded(false)}
        >
          <button
            className="avatar-lightbox__close"
            aria-label={t("common.cancel")}
          >
            <X size={22} />
          </button>
          <img
            src={getImageUrl(profile.avatarUrl)}
            alt={profile.userName}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
