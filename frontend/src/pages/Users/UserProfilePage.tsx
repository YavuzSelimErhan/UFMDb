import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { UserRound, MapPin, Pencil } from "lucide-react";
import { followService } from "@/services";
import { useAppSelector } from "@/store";
import FollowButton from "@/components/user/FollowButton";
import FollowListModal from "@/components/user/FollowListModal";
import { getEntityTheme } from "@/utils/listTheme";
import { PageSpinner, PageError } from "@/components/common/PageState";
import "./UserProfilePage.css";

export default function UserProfilePage() {
  const { userName } = useParams<{ userName: string }>();
  const { t } = useTranslation();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [modalMode, setModalMode] = useState<"followers" | "following" | null>(
    null,
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["user-profile", userName],
    queryFn: () => followService.getProfileByUserName(userName!),
    enabled: !!userName,
    retry: 1,
  });

  if (isLoading) return <PageSpinner label={t("common.loading")} />;
  if (isError || !data)
    return (
      <PageError message={t("errors.genericError")} onRetry={() => refetch()} />
    );

  const theme = getEntityTheme(data.id);
  const genderLabel =
    data.gender === "Male"
      ? t("profile.genderMale")
      : data.gender === "Female"
        ? t("profile.genderFemale")
        : null;

  return (
    <div
      className="container user-profile"
      style={
        {
          "--user-accent": theme.accent,
          "--user-accent-soft": theme.accentSoft,
        } as React.CSSProperties
      }
    >
      <div className="user-profile__header card">
        <div className="user-profile__avatar">
          {data.avatarUrl ? (
            <img src={data.avatarUrl} alt="" />
          ) : (
            <UserRound size={40} />
          )}
        </div>

        <div className="user-profile__info">
          <div className="user-profile__name-row">
            <h1>{data.fullName || data.userName}</h1>
            {data.isCurrentUser ? (
              <Link
                to="/profile/edit"
                className="btn-secondary user-profile__edit-btn"
              >
                <Pencil size={14} /> {t("profile.editProfile")}
              </Link>
            ) : isAuthenticated ? (
              <FollowButton
                userId={data.id}
                isFollowing={data.isFollowedByCurrentUser}
              />
            ) : null}
          </div>
          <span className="user-profile__username">@{data.userName}</span>

          {data.biography && (
            <p className="user-profile__bio">{data.biography}</p>
          )}

          {(data.country || genderLabel) && (
            <div className="user-profile__meta-row">
              {data.country && (
                <span className="user-profile__meta-item">
                  <MapPin size={13} /> {data.country}
                </span>
              )}
              {genderLabel && (
                <span className="user-profile__meta-item">{genderLabel}</span>
              )}
            </div>
          )}

          <div className="user-profile__stats">
            <button
              type="button"
              className="user-profile__stat"
              onClick={() => setModalMode("followers")}
            >
              <strong>{data.followerCount}</strong> {t("users.followersLabel")}
            </button>
            <button
              type="button"
              className="user-profile__stat"
              onClick={() => setModalMode("following")}
            >
              <strong>{data.followingCount}</strong> {t("users.followingLabel")}
            </button>
          </div>
        </div>
      </div>

      {modalMode && (
        <FollowListModal
          userId={data.id}
          mode={modalMode}
          onClose={() => setModalMode(null)}
        />
      )}
    </div>
  );
}
