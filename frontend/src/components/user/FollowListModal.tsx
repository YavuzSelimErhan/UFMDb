import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { X, UserRound } from "lucide-react";
import { followService } from "@/services";
import FollowButton from "./FollowButton";
import { PageSpinner, EmptyState } from "@/components/common/PageState";
import "./FollowListModal.css";

interface FollowListModalProps {
  userId: string;
  mode: "followers" | "following";
  onClose: () => void;
}

export default function FollowListModal({
  userId,
  mode,
  onClose,
}: FollowListModalProps) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: [mode, userId],
    queryFn: () =>
      mode === "followers"
        ? followService.getFollowers(userId)
        : followService.getFollowing(userId),
  });

  return (
    <div className="follow-modal__backdrop" onClick={onClose}>
      <div className="follow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="follow-modal__header">
          <h3>
            {mode === "followers"
              ? t("users.followersLabel")
              : t("users.followingLabel")}
          </h3>
          <button className="follow-modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="follow-modal__body">
          {isLoading && <PageSpinner label={t("common.loading")} />}

          {data && data.length === 0 && (
            <EmptyState
              icon={<UserRound size={22} />}
              title={
                mode === "followers"
                  ? t("users.noFollowers")
                  : t("users.noFollowing")
              }
            />
          )}

          {data?.map((user) => (
            <div key={user.id} className="follow-modal__row">
              <Link
                to={`/users/${user.userName}`}
                className="follow-modal__row-link"
                onClick={onClose}
              >
                <div className="follow-modal__avatar">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" />
                  ) : (
                    <UserRound size={18} />
                  )}
                </div>
                <div className="follow-modal__row-info">
                  <span className="follow-modal__row-name">
                    {user.fullName || user.userName}
                  </span>
                  <span className="follow-modal__row-username">
                    @{user.userName}
                  </span>
                </div>
              </Link>
              <FollowButton
                userId={user.id}
                isFollowing={user.isFollowedByCurrentUser}
                size="sm"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
