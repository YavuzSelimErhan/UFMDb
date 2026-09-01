import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { UserPlus, UserCheck } from "lucide-react";
import { followService } from "@/services";
import { useAppSelector } from "@/store";
import "./FollowButton.css";

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  onChange?: (isFollowing: boolean) => void;
  size?: "sm" | "md";
}

export default function FollowButton({
  userId,
  isFollowing,
  onChange,
  size = "md",
}: FollowButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState(isFollowing);

  useEffect(() => setOptimistic(isFollowing), [isFollowing]);

  const mutation = useMutation({
    mutationFn: () => followService.toggleFollow(userId),
    onMutate: () => {
      const prev = optimistic;
      setOptimistic(!prev);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) setOptimistic(ctx.prev);
    },
    onSuccess: (result) => {
      setOptimistic(result);
      onChange?.(result);
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
      queryClient.invalidateQueries({ queryKey: ["users-search"] });
    },
  });

  const handleClick = () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    mutation.mutate();
  };

  return (
    <button
      type="button"
      className={`follow-btn follow-btn--${size} ${
        optimistic ? "follow-btn--following" : ""
      }`}
      onClick={handleClick}
      disabled={mutation.isPending}
    >
      {optimistic ? (
        <>
          <UserCheck size={14} /> {t("users.following")}
        </>
      ) : (
        <>
          <UserPlus size={14} /> {t("users.follow")}
        </>
      )}
    </button>
  );
}
