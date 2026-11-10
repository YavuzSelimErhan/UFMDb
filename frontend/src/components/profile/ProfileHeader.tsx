import { useState, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Star, X, UserCheck, UserPlus } from "lucide-react";
import type { ProfileData, PublicFullProfileDto } from "@/types";
import { getImageUrl } from "@/utils/getImageUrl";
import FollowListModal from "@/components/user/FollowListModal";
import CompatibilityBadge from "@/components/user/CompatibilityBadge";
import {
  useWatchedFilmsCounts,
  watchedCountsKey,
} from "@/hooks/useWatchedFilmsCounts";
import "./ProfileHeader.css";

interface Props {
  profile: ProfileData | PublicFullProfileDto;
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
  const queryClient = useQueryClient();
  const [isAvatarExpanded, setIsAvatarExpanded] = useState(false);
  const [followModal, setFollowModal] = useState<
    "followers" | "following" | null
  >(null);

  // Film sayılarının tek kaynağı: counts cache'i. Profil yanıtıyla gelen
  // değerleri buraya yazıyoruz; böylece header, sekme rozeti ve FilmsTab
  // aynı veriyi okuyor ve ek istek atılmıyor.
  // useLayoutEffect: aynı anda mount olan FilmsTab'ın counts sorgusu
  // fetch başlatmadan (passive effect) önce cache dolmuş olsun.
  const countsUserId = isCurrentUser ? undefined : userId;
  useLayoutEffect(() => {
    if (profile.watchedCounts) {
      queryClient.setQueryData(
        watchedCountsKey(countsUserId),
        profile.watchedCounts,
      );
    }
  }, [profile.watchedCounts, countsUserId, queryClient]);

  const { data: counts } = useWatchedFilmsCounts(countsUserId);

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

  // Banner: ilk dolu favori slotun arka plan görseli. Yoksa banner hiç
  // render edilmez; avatar ve isim doğrudan kartın üstünden başlar.
  const backdropPath = profile.favoriteMovies?.find(
    (slot) => slot.movie?.backdropUrl,
  )?.movie?.backdropUrl;
  const bannerStyle = backdropPath
    ? ({
        "--banner-image": `url(${JSON.stringify(getImageUrl(backdropPath))})`,
      } as React.CSSProperties)
    : undefined;

  type StatItem = {
    key: string;
    value: number;
    label: string;
  } & ({ kind: "link"; to: string } | { kind: "button"; onClick: () => void });

  const stats: StatItem[] = [
    {
      key: "followers",
      kind: "button",
      onClick: () => setFollowModal("followers"),
      value: profile.followerCount ?? 0,
      label: t("profile.statFollowers"),
    },
    {
      key: "following",
      kind: "button",
      onClick: () => setFollowModal("following"),
      value: profile.followingCount ?? 0,
      label: t("profile.statFollowing"),
    },
    {
      key: "films",
      kind: "link",
      to: isCurrentUser
        ? "/profile?tab=films"
        : `/users/${targetUserName}?tab=films`,
      value: counts?.all ?? profile.watchedCounts?.all ?? 0,
      label: t("profile.statFilms"),
    },
    {
      key: "reviews",
      kind: "link",
      to: isCurrentUser
        ? "/profile?tab=reviews"
        : `/users/${targetUserName}?tab=reviews`,
      value: profile.reviews.length,
      label: t("profile.statReviews"),
    },
    {
      key: "lists",
      kind: "link",
      to: isCurrentUser
        ? "/profile?tab=lists"
        : `/users/${targetUserName}?tab=lists`,
      value: listsCount ?? 0,
      label: t("profile.statLists"),
    },
  ];

  const showMetaRow =
    age !== null ||
    genderLabel !== null ||
    (isCurrentUser && !profile.biography);

  return (
    <div className="profile-header">
      {backdropPath && (
        <div
          className="profile-header__banner"
          style={bannerStyle}
          aria-hidden="true"
        />
      )}

      <div
        className={`profile-header__body${
          backdropPath ? " profile-header__body--banner" : ""
        }`}
      >
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
                <span>
                  {t("profile.member")} {memberSince}
                </span>
              </>
            )}
            {profile.country && (
              <>
                <span className="profile-header__dot">·</span>
                <span>{profile.country}</span>
              </>
            )}
          </p>

          {showMetaRow && (
            <div className="profile-header__meta">
              {age !== null && (
                <span className="profile-header__badge">{age}</span>
              )}
              {genderLabel && (
                <span className="profile-header__badge">{genderLabel}</span>
              )}
              {isCurrentUser && !profile.biography && (
                <button
                  type="button"
                  className="profile-header__add-bio"
                  onClick={onEditClick}
                >
                  {t("profile.addBio")}
                </button>
              )}
            </div>
          )}

          {profile.biography && (
            <p className="profile-header__bio">{profile.biography}</p>
          )}
        </div>

        <div className="profile-header__actions">
          {isCurrentUser ? (
            <button
              type="button"
              className="btn-secondary profile-header__btn profile-header__btn--accent"
              onClick={onEditClick}
            >
              <Pencil size={14} /> {t("profile.editProfile")}
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary profile-header__btn"
              onClick={onFollowToggle}
              disabled={isFollowLoading}
            >
              {isFollowedByCurrentUser ? (
                <>
                  <UserCheck size={14} /> {t("users.following")}
                </>
              ) : (
                <>
                  <UserPlus size={14} /> {t("users.follow")}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {!isCurrentUser && (
        <div className="profile-header__compat">
          <CompatibilityBadge
            userId={userId}
            userName={profile.userName}
            avatarUrl={profile.avatarUrl}
          />
        </div>
      )}

      <div className="profile-header__stats">
        {stats.map((s) => {
          const content = (
            <>
              <span className="profile-header__stat-value">{s.value}</span>
              <span className="profile-header__stat-label">{s.label}</span>
            </>
          );
          return s.kind === "link" ? (
            <Link to={s.to} className="profile-header__stat" key={s.key}>
              {content}
            </Link>
          ) : (
            <button
              type="button"
              className="profile-header__stat"
              key={s.key}
              onClick={s.onClick}
            >
              {content}
            </button>
          );
        })}
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
