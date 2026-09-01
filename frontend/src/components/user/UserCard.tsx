import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { getEntityTheme } from "@/utils/listTheme";
import FollowButton from "./FollowButton";
import type { UserSummaryDto } from "@/types";
import "./UserCard.css";

interface UserCardProps {
  user: UserSummaryDto;
}

export default function UserCard({ user }: UserCardProps) {
  const theme = getEntityTheme(user.id);

  return (
    <div
      className="user-card"
      style={
        {
          "--user-accent": theme.accent,
          "--user-accent-soft": theme.accentSoft,
        } as React.CSSProperties
      }
    >
      <Link to={`/users/${user.userName}`} className="user-card__link">
        <div className="user-card__avatar">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <UserRound size={22} />
          )}
        </div>
        <div className="user-card__info">
          <h3>{user.fullName || user.userName}</h3>
          <span className="user-card__username">@{user.userName}</span>
        </div>
      </Link>
      <FollowButton
        userId={user.id}
        isFollowing={user.isFollowedByCurrentUser}
        size="sm"
      />
    </div>
  );
}
