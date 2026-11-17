import { useState, useEffect, useLayoutEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Star,
  X,
  MapPin,
  UserCheck,
  UserPlus,
  Share2,
  Check,
  ImagePlus,
} from "lucide-react";
import type { ProfileData, PublicFullProfileDto } from "@/types";
import { profileService } from "@/services";
import { getImageUrl } from "@/utils/getImageUrl";
import FollowListModal from "@/components/user/FollowListModal";
import CompatibilityBadge from "@/components/user/CompatibilityBadge";
import CoverPickerModal from "./CoverPickerModal";
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

type StatItem = {
  key: string;
  value: string | number;
  label: string;
  icon?: ReactNode;
  to?: string;
};

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
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Avatar lightbox: Escape ile kapanır.
  useEffect(() => {
    if (!isAvatarExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsAvatarExpanded(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAvatarExpanded]);

  // "Bağlantı kopyalandı" geri bildirimi 2 sn sonra eski haline döner.
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const coverMutation = useMutation({
    mutationFn: (movieId: string | null) => profileService.setCover(movieId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setIsCoverPickerOpen(false);
    },
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/users/${profile.userName}`;
    const isTouch = window.matchMedia?.("(pointer: coarse)").matches;
    if (isTouch && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: profile.fullName || profile.userName,
          url,
        });
      } catch {
        // Kullanıcı paylaşım menüsünü kapattı; yapılacak bir şey yok.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Pano erişimi reddedildi; sessizce geç.
    }
  };

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

  const metaParts = [
    profile.country,
    age !== null ? String(age) : null,
    genderLabel,
  ].filter((p): p is string => !!p);

  const targetUserName = profile.userName;
  const tabLink = (tab: string) =>
    isCurrentUser
      ? `/profile?tab=${tab}`
      : `/users/${targetUserName}?tab=${tab}`;

  const coverUrl = profile.coverBackdropUrl
    ? getImageUrl(profile.coverBackdropUrl)
    : null;

  const favoriteMovies = profile.favoriteMovies
    .map((slot) => slot.movie)
    .filter((m): m is NonNullable<typeof m> => !!m);

  // null => backend istatistiği gizledi (defter gizli): kutuyu hiç göstermiyoruz.
  const thisYear = counts?.thisYear ?? profile.watchedCounts?.thisYear;

  const stats: StatItem[] = [
    {
      key: "films",
      to: tabLink("films"),
      value: counts?.all ?? profile.watchedCounts?.all ?? 0,
      label: t("profile.statFilms"),
    },
    ...(thisYear != null
      ? [
          {
            key: "thisYear",
            to: tabLink("films"),
            value: thisYear,
            label: t("profile.statThisYear", { defaultValue: "Bu yıl" }),
          },
        ]
      : []),
    {
      key: "reviews",
      to: tabLink("reviews"),
      value: profile.reviews.length,
      label: t("profile.statReviews"),
    },
    {
      key: "lists",
      to: tabLink("lists"),
      value: listsCount ?? 0,
      label: t("profile.statLists"),
    },
    ...(profile.averageGivenRating !== null
      ? [
          {
            key: "rating",
            value: profile.averageGivenRating.toFixed(1),
            icon: <Star size={15} fill="currentColor" aria-hidden="true" />,
            label: t("profile.statAvgRating", { defaultValue: "Ort. puan" }),
          },
        ]
      : []),
  ];

  const shareButton = (
    <button
      type="button"
      className="profile-header__btn"
      onClick={handleShare}
      aria-label={t("profile.share", { defaultValue: "Paylaş" })}
    >
      {copied ? (
        <Check size={14} aria-hidden="true" />
      ) : (
        <Share2 size={14} aria-hidden="true" />
      )}
      <span className="profile-header__btn-label">
        {copied
          ? t("profile.linkCopied", { defaultValue: "Bağlantı kopyalandı" })
          : t("profile.share", { defaultValue: "Paylaş" })}
      </span>
    </button>
  );

  return (
    <header className="profile-header">
      <div
        className={`profile-header__cover${coverUrl ? "" : " profile-header__cover--empty"}`}
        style={coverUrl ? { backgroundImage: `url("${coverUrl}")` } : undefined}
      >
        <div className="profile-header__cover-actions">
          {isCurrentUser ? (
            <button
              type="button"
              className="profile-header__btn"
              onClick={onEditClick}
              aria-label={t("profile.editProfile")}
            >
              <Pencil size={14} aria-hidden="true" />
              <span className="profile-header__btn-label">
                {t("profile.editProfile")}
              </span>
            </button>
          ) : (
            <>
              <CompatibilityBadge
                variant="action"
                userId={userId}
                userName={profile.userName}
                avatarUrl={profile.avatarUrl}
              />
              <button
                type="button"
                className="profile-header__btn"
                onClick={onFollowToggle}
                disabled={isFollowLoading}
                aria-label={
                  isFollowedByCurrentUser
                    ? t("users.following")
                    : t("users.follow")
                }
              >
                {isFollowedByCurrentUser ? (
                  <UserCheck size={14} aria-hidden="true" />
                ) : (
                  <UserPlus size={14} aria-hidden="true" />
                )}
                <span className="profile-header__btn-label">
                  {isFollowedByCurrentUser
                    ? t("users.following")
                    : t("users.follow")}
                </span>
              </button>
            </>
          )}
          {shareButton}
        </div>

        {isCurrentUser && (
          <button
            type="button"
            className="profile-header__btn profile-header__btn--small profile-header__cover-change"
            onClick={() => setIsCoverPickerOpen(true)}
            aria-label={t("profile.changeCover", {
              defaultValue: "Kapağı değiştir",
            })}
          >
            <ImagePlus size={13} aria-hidden="true" />
            <span className="profile-header__btn-label">
              {t("profile.changeCover", { defaultValue: "Kapağı değiştir" })}
            </span>
          </button>
        )}
      </div>

      <div className="profile-header__main">
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

        <div className="profile-header__identity">
          <h1 className="profile-header__name">
            {profile.fullName || profile.userName}
          </h1>

          <p className="profile-header__handle">
            @{profile.userName}
            {memberSince && (
              <>
                <span className="profile-header__dot">·</span>
                {t("profile.member")} {memberSince}
              </>
            )}
          </p>

          <div className="profile-header__line">
            <span className="profile-header__follow">
              <button type="button" onClick={() => setFollowModal("followers")}>
                <b>{profile.followerCount ?? 0}</b> {t("profile.statFollowers")}
              </button>
              <span className="profile-header__dot">·</span>
              <button type="button" onClick={() => setFollowModal("following")}>
                <b>{profile.followingCount ?? 0}</b>{" "}
                {t("profile.statFollowing")}
              </button>
            </span>

            {metaParts.length > 0 && (
              <span className="profile-header__meta">
                {profile.country && <MapPin size={14} aria-hidden="true" />}
                {metaParts.join(" · ")}
              </span>
            )}
          </div>

          {profile.biography && (
            <p className="profile-header__bio">{profile.biography}</p>
          )}
        </div>
      </div>

      <div className="profile-header__stats">
        {stats.map((s) => {
          const inner = (
            <>
              <span className="profile-header__stat-value">
                {s.icon}
                {s.value}
              </span>
              <span className="profile-header__stat-label">{s.label}</span>
            </>
          );
          return s.to ? (
            <Link to={s.to} className="profile-header__stat" key={s.key}>
              {inner}
            </Link>
          ) : (
            <div
              className="profile-header__stat profile-header__stat--static"
              key={s.key}
            >
              {inner}
            </div>
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

      {isCoverPickerOpen && (
        <CoverPickerModal
          favorites={favoriteMovies}
          selectedId={profile.coverMovieId}
          isSaving={coverMutation.isPending}
          isError={coverMutation.isError}
          onSelect={(movieId) => coverMutation.mutate(movieId)}
          onClose={() => setIsCoverPickerOpen(false)}
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
    </header>
  );
}
