import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Pencil,
  Star,
  X,
  MapPin,
  Users,
  UserCheck,
  Film,
  MessageSquare,
  ListVideo,
} from "lucide-react";
import type { ProfileData } from "@/types";
import { getImageUrl } from "@/utils/getImageUrl";
import "./ProfileHeader.css";

interface Props {
  profile: ProfileData;
  onEditClick: () => void;
  listsCount?: number;
}

function calculateAge(birthDate: string): number | null {
  const bd = new Date(birthDate);
  if (isNaN(bd.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const monthDiff = today.getMonth() - bd.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bd.getDate())) {
    age--;
  }
  return age;
}

export default function ProfileHeader({
  profile,
  onEditClick,
  listsCount,
}: Props) {
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

  const age = profile.birthDate ? calculateAge(profile.birthDate) : null;

  const genderLabel =
    profile.gender === "Male"
      ? t("profile.genderMale")
      : profile.gender === "Female"
        ? t("profile.genderFemale")
        : null;

  const stats = [
    {
      key: "followers",
      to: "/profile/followers",
      icon: Users,
      value: profile.followerCount ?? 0,
      label: t("profile.statFollowers"),
    },
    {
      key: "following",
      to: "/profile/following",
      icon: UserCheck,
      value: profile.followingCount ?? 0,
      label: t("profile.statFollowing"),
    },
    {
      key: "films",
      to: "/profile?tab=films",
      icon: Film,
      value: profile.totalWatchedCount ?? 0,
      label: t("profile.statFilms"),
    },
    {
      key: "reviews",
      to: "/profile?tab=reviews",
      icon: MessageSquare,
      value: profile.reviews.length,
      label: t("profile.statReviews"),
    },
    {
      key: "lists",
      to: "/profile?tab=lists",
      icon: ListVideo,
      value: listsCount ?? 0,
      label: t("profile.statLists"),
    },
  ];

  return (
    <div className="profile-header">
      <div className="profile-header__perf" aria-hidden="true" />

      <div className="profile-header__body">
        <div className="profile-header__avatar-col">
          <button
            type="button"
            className="profile-header__avatar"
            onClick={() => profile.avatarUrl && setIsAvatarExpanded(true)}
            aria-label={t("profile.viewAvatar")}
          >
            {profile.avatarUrl ? (
              <img
                src={getImageUrl(profile.avatarUrl)}
                alt={profile.userName}
              />
            ) : (
              <span>{profile.userName[0]?.toUpperCase()}</span>
            )}
          </button>
        </div>

        <div className="profile-header__info">
          <div className="profile-header__top-row">
            <div>
              <div className="profile-header__name-row">
                <h1 className="profile-header__name">
                  {profile.fullName || profile.userName}
                </h1>
                {profile.averageGivenRating !== null && (
                  <span className="profile-header__rating">
                    <Star size={13} fill="currentColor" />
                    {profile.averageGivenRating.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="profile-header__handle">
                <strong>@{profile.userName}</strong>
                {memberSince && (
                  <>
                    <span className="profile-header__dot">·</span>
                    {t("profile.member")} {memberSince}
                  </>
                )}
              </p>
            </div>

            <button
              className="btn-secondary profile-header__edit-btn"
              onClick={onEditClick}
            >
              <Pencil size={14} /> {t("profile.editProfile")}
            </button>
          </div>

          {(profile.country || age !== null || genderLabel) && (
            <div className="profile-header__badges">
              {profile.country && (
                <span className="profile-header__badge">
                  <MapPin size={13} /> {profile.country}
                </span>
              )}
              {age !== null && (
                <span className="profile-header__badge">{age}</span>
              )}
              {genderLabel && (
                <span className="profile-header__badge">{genderLabel}</span>
              )}
            </div>
          )}

          {profile.biography && (
            <p className="profile-header__bio">
              &ldquo;{profile.biography}&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="profile-header__perf-divider" aria-hidden="true" />

      <div className="profile-header__stats">
        {stats.map(({ key, to, icon: Icon, value, label }) => (
          <Link to={to} className="profile-header__stat" key={key}>
            <Icon size={16} className="profile-header__stat-icon" />
            <span className="profile-header__stat-text">
              <span className="profile-header__stat-value">{value}</span>
              <span className="profile-header__stat-label">{label}</span>
            </span>
          </Link>
        ))}
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
