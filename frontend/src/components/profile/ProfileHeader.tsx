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
  UserPlus,
  Film,
  MessageSquare,
  ListVideo,
} from "lucide-react";
import type { PublicFullProfileDto } from "@/types";
import { getImageUrl } from "@/utils/getImageUrl";
import FollowListModal from "@/components/user/FollowListModal";
import "./ProfileHeader.css";

interface Props {
  profile: PublicFullProfileDto;
  userId: string;
  onEditClick?: () => void;
  listsCount?: number;
  isCurrentUser?: boolean;
  isFollowedByCurrentUser?: boolean;
  onFollowToggle?: () => void;
  isFollowLoading?: boolean;
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
  userId,
  onEditClick,
  listsCount,
  isCurrentUser = true,
  isFollowedByCurrentUser = false,
  onFollowToggle,
  isFollowLoading = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const [isAvatarExpanded, setIsAvatarExpanded] = useState(false);
  const [followModal, setFollowModal] = useState<
    "followers" | "following" | null
  >(null);

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

  const targetUserName = profile.userName;

  type StatItem = {
    key: string;
    icon: typeof Users;
    value: number;
    label: string;
  } & ({ kind: "link"; to: string } | { kind: "button"; onClick: () => void });

  const stats: StatItem[] = [
    {
      key: "followers",
      kind: "button",
      onClick: () => setFollowModal("followers"),
      icon: Users,
      value: profile.followerCount ?? 0,
      label: t("profile.statFollowers"),
    },
    {
      key: "following",
      kind: "button",
      onClick: () => setFollowModal("following"),
      icon: UserCheck,
      value: profile.followingCount ?? 0,
      label: t("profile.statFollowing"),
    },
    {
      key: "films",
      kind: "link",
      to: isCurrentUser
        ? "/profile?tab=films"
        : `/users/${targetUserName}?tab=films`,
      icon: Film,
      value: profile.totalWatchedCount ?? 0,
      label: t("profile.statFilms"),
    },
    {
      key: "reviews",
      kind: "link",
      to: isCurrentUser
        ? "/profile?tab=reviews"
        : `/users/${targetUserName}?tab=reviews`,
      icon: MessageSquare,
      value: profile.reviews.length,
      label: t("profile.statReviews"),
    },
    {
      key: "lists",
      kind: "link",
      to: isCurrentUser
        ? "/profile?tab=lists"
        : `/users/${targetUserName}?tab=lists`,
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

            {isCurrentUser ? (
              <button
                className="btn-secondary profile-header__edit-btn"
                onClick={onEditClick}
              >
                <Pencil size={14} /> {t("profile.editProfile")}
              </button>
            ) : (
              <button
                className="btn-secondary profile-header__edit-btn"
                onClick={onFollowToggle}
                disabled={isFollowLoading}
              >
                {isFollowedByCurrentUser ? (
                  <>
                    <UserCheck size={14} /> {t("profile.following")}
                  </>
                ) : (
                  <>
                    <UserPlus size={14} /> {t("profile.follow")}
                  </>
                )}
              </button>
            )}
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
        {stats.map((s) =>
          s.kind === "link" ? (
            <Link to={s.to} className="profile-header__stat" key={s.key}>
              <s.icon size={16} className="profile-header__stat-icon" />
              <span className="profile-header__stat-text">
                <span className="profile-header__stat-value">{s.value}</span>
                <span className="profile-header__stat-label">{s.label}</span>
              </span>
            </Link>
          ) : (
            <button
              type="button"
              className="profile-header__stat"
              key={s.key}
              onClick={s.onClick}
            >
              <s.icon size={16} className="profile-header__stat-icon" />
              <span className="profile-header__stat-text">
                <span className="profile-header__stat-value">{s.value}</span>
                <span className="profile-header__stat-label">{s.label}</span>
              </span>
            </button>
          ),
        )}
      </div>

      {followModal && (
        <FollowListModal
          userId={userId}
          mode={followModal}
          onClose={() => setFollowModal(null)}
        />
      )}

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
