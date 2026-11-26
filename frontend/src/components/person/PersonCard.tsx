import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { personService } from "@/services";
import { useAppSelector } from "@/store";
import { getEntityTheme } from "@/utils/listTheme";
import type { PersonSearchItem } from "@/types";
import "./PersonCard.css";

interface Props {
  person: PersonSearchItem;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function PersonCard({ person }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);

  const [liked, setLiked] = useState(person.isLikedByCurrentUser);
  const [likeCount, setLikeCount] = useState(person.likeCount);
  const [photoFailed, setPhotoFailed] = useState(false);

  // Sunucudan taze veri gelince (sayfalama, yeniden sorgu) yerel durumu eşitle.
  useEffect(() => {
    setLiked(person.isLikedByCurrentUser);
    setLikeCount(person.likeCount);
  }, [person.isLikedByCurrentUser, person.likeCount]);

  useEffect(() => {
    setPhotoFailed(false);
  }, [person.id]);

  const likeMutation = useMutation({
    mutationFn: () => personService.toggleLike(person.id),
    onMutate: () => {
      const previous = { liked, likeCount };
      setLiked(!previous.liked);
      setLikeCount(previous.likeCount + (previous.liked ? -1 : 1));
      return previous;
    },
    onSuccess: (nowLiked, _vars, previous) => {
      setLiked(nowLiked);
      if (previous)
        setLikeCount(
          previous.likeCount - (previous.liked ? 1 : 0) + (nowLiked ? 1 : 0),
        );
      // Not: ["people-search"] bilerek yenilenmiyor; kart, imlecin altından kaymasın.
      queryClient.invalidateQueries({ queryKey: ["person", person.id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (_err, _vars, previous) => {
      if (previous) {
        setLiked(previous.liked);
        setLikeCount(previous.likeCount);
      }
    },
  });

  const theme = getEntityTheme(person.id);
  const showFallback = !person.photoUrl || photoFailed;
  const roleLabel = person.primaryRole
    ? t(`people.roles.${person.primaryRole}`)
    : null;
  const likeLabel = liked ? t("movie.unlike") : t("movie.like");
  const countText =
    likeCount > 0
      ? new Intl.NumberFormat(i18n.language, { notation: "compact" }).format(
          likeCount,
        )
      : null;

  return (
    <Link to={`/people/${person.id}`} className="person-card card">
      <div className="person-card__photo-wrap">
        {showFallback ? (
          <div
            className="person-card__photo-fallback"
            style={
              {
                "--fallback-accent": theme.accent,
                "--fallback-accent-soft": theme.accentSoft,
              } as React.CSSProperties
            }
          >
            <span>{initialsOf(person.fullName) || "?"}</span>
          </div>
        ) : (
          <img
            src={person.photoUrl}
            alt={person.fullName}
            loading="lazy"
            decoding="async"
            className="person-card__photo"
            onError={() => setPhotoFailed(true)}
          />
        )}

        {isAuthenticated ? (
          <button
            type="button"
            className={`person-card__like ${liked ? "is-active" : ""}`}
            disabled={likeMutation.isPending}
            title={likeLabel}
            aria-label={likeLabel}
            aria-pressed={liked}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              likeMutation.mutate();
            }}
          >
            <Heart size={13} fill={liked ? "currentColor" : "none"} />
            {countText && <span>{countText}</span>}
          </button>
        ) : (
          countText && (
            <span className="person-card__like person-card__like--static">
              <Heart size={13} />
              <span>{countText}</span>
            </span>
          )
        )}
      </div>

      <div className="person-card__info">
        <h3 className="person-card__name">{person.fullName}</h3>
        {(roleLabel || person.filmCount > 0) && (
          <div className="person-card__meta">
            {roleLabel && (
              <span className="person-card__role">{roleLabel}</span>
            )}
            {person.filmCount > 0 && (
              <span>{t("people.filmCount", { count: person.filmCount })}</span>
            )}
          </div>
        )}
        {person.nationality && (
          <p className="person-card__nationality">{person.nationality}</p>
        )}
      </div>
    </Link>
  );
}
