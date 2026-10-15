import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Heart,
  Layers,
  Pencil,
  Trash2,
  Check,
  X,
  Lock,
  Link2,
  FileEdit,
  Archive,
  ListOrdered,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listService } from "@/services";
import { useAppSelector } from "@/store";
import { getListTheme } from "@/utils/listTheme";
import type { ListSummary } from "@/types";
import "./ListsPage.css";

interface Props {
  list: ListSummary;
  displayTitle: string;
  displayDescription: string;
}

export default function ListCard({
  list,
  displayTitle,
  displayDescription,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    isAuthenticated,
    userId: currentUserId,
    role,
  } = useAppSelector((s) => s.auth);
  const [isLiked, setIsLiked] = useState(list.isLikedByCurrentUser);
  const [likeCount, setLikeCount] = useState(list.likeCount);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const isAdmin = role === "Admin";
  const isOwner = currentUserId === list.createdByUserId;
  // Backend de aynı kuralı uyguluyor: resmi listeleri sadece admin düzenler/siler.
  const canEdit = list.isOfficial ? isAdmin : isAdmin || isOwner;

  // Rozet sadece sahibine görünür; başkasının kartında zaten sadece herkese açık + yayında listeler gelir.
  const statusBadge = !isOwner
    ? null
    : list.status === "Draft"
      ? { icon: <FileEdit size={11} />, label: t("lists.draft") }
      : list.status === "Archived"
        ? { icon: <Archive size={11} />, label: t("lists.archived") }
        : list.visibility === "Private"
          ? { icon: <Lock size={11} />, label: t("lists.private") }
          : list.visibility === "Unlisted"
            ? { icon: <Link2 size={11} />, label: t("lists.unlisted") }
            : null;

  const likeMutation = useMutation({
    mutationFn: () => listService.toggleLike(list.id),
    onMutate: () => {
      const prevLiked = isLiked;
      const prevCount = likeCount;
      setIsLiked(!prevLiked);
      setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
      return { prevLiked, prevCount };
    },
    onSuccess: (newState) => {
      setIsLiked(newState);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (_err, _vars, context) => {
      if (context) {
        setIsLiked(context.prevLiked);
        setLikeCount(context.prevCount);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => listService.remove(list.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const theme = getListTheme(list.id);
  const themeStyle = {
    "--list-accent": theme.accent,
    "--list-accent-soft": theme.accentSoft,
    "--list-accent-strong": theme.accentStrong,
  } as React.CSSProperties;

  return (
    <Link
      to={`/lists/${list.slug}`}
      className="list-card card"
      style={themeStyle}
    >
      <div className="list-card__stage">
        {list.coverImageUrl ? (
          <img
            src={list.coverImageUrl}
            alt=""
            className="list-card__stage-img"
          />
        ) : list.coverPosters.length > 0 ? (
          <div className="list-card__fan">
            {list.coverPosters.slice(0, 4).map((poster, i) => (
              <img
                key={i}
                src={poster}
                alt=""
                className="list-card__fan-poster"
              />
            ))}
          </div>
        ) : (
          <div className="list-card__stage-empty">
            <Layers size={26} />
          </div>
        )}

        {isAuthenticated && (
          <button
            type="button"
            className={`list-card__like ${isLiked ? "is-active" : ""}`}
            disabled={likeMutation.isPending}
            title={isLiked ? t("movie.unlike") : t("movie.like")}
            aria-label={isLiked ? t("movie.unlike") : t("movie.like")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              likeMutation.mutate();
            }}
          >
            <Heart size={13} fill={isLiked ? "currentColor" : "none"} />
          </button>
        )}

        {canEdit && !isDeleteOpen && (
          <div className="list-card__owner-actions">
            <button
              type="button"
              className="list-card__icon-btn"
              title={t("lists.editList")}
              aria-label={t("lists.editList")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/lists/edit/${list.id}`);
              }}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className="list-card__icon-btn list-card__icon-btn--danger"
              title={t("lists.deleteList")}
              aria-label={t("lists.deleteList")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDeleteOpen(true);
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {canEdit && isDeleteOpen && (
          <div className="list-card__owner-actions">
            <button
              type="button"
              className="list-card__icon-btn list-card__icon-btn--confirm"
              disabled={deleteMutation.isPending}
              aria-label={t("common.confirm")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteMutation.mutate();
              }}
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              className="list-card__icon-btn"
              aria-label={t("common.cancel")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDeleteOpen(false);
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {statusBadge && (
          <span className="list-card__badge list-card__badge--status">
            {statusBadge.icon} {statusBadge.label}
          </span>
        )}
        {list.isRanked && (
          <span className="list-card__badge list-card__badge--ranked">
            <ListOrdered size={11} /> {t("lists.ranked")}
          </span>
        )}
      </div>

      <div className="list-card__perf" aria-hidden="true" />

      <div className="list-card__body">
        <h3 title={displayTitle}>{displayTitle}</h3>
        <p className="text-secondary list-card__desc">{displayDescription}</p>
        <div className="list-card__meta-row">
          <span className="list-card__ticket">
            {list.movieCount} {t("lists.moviesCount")}
          </span>
          <span className="list-card__like-count">
            <Heart size={13} fill={likeCount > 0 ? "currentColor" : "none"} />{" "}
            {likeCount}
          </span>
        </div>
        {!list.isOfficial && (
          <p className="list-card__creator text-muted">
            {t("lists.byUser", { name: list.createdByUserName })}
          </p>
        )}
      </div>
    </Link>
  );
}
