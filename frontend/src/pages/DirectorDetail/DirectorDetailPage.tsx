import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { directorService } from "@/services";
import { useAppSelector } from "@/store";
import MovieCard from "@/components/movie/MovieCard";
import { PageSpinner, PageError } from "@/components/common/PageState";
import "./DirectorDetailPage.css";

export default function DirectorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);

  const {
    data: director,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["director", id],
    queryFn: () => directorService.getById(id!),
    enabled: !!id,
    retry: 1,
  });

  const likeMutation = useMutation({
    mutationFn: () => directorService.toggleLike(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["director", id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });

  if (isLoading) return <PageSpinner label={t("common.loading")} />;
  if (isError || !director)
    return (
      <PageError
        message={t("errors.directorDetailFailed")}
        onRetry={() => refetch()}
      />
    );

  return (
    <div className="container actor-page">
      <div className="actor-page__header">
        <img
          src={director.photoUrl}
          alt={director.fullName}
          className="actor-page__photo"
        />
        <div className="actor-page__header-info">
          <h1>{director.fullName}</h1>
          {director.birthDate && (
            <p className="text-muted">
              {t("actor.born")}:{" "}
              {new Date(director.birthDate).toLocaleDateString()}
            </p>
          )}
          <p className="text-secondary actor-page__bio">
            {director.biography || t("actor.noBiography")}
          </p>

          {isAuthenticated && (
            <button
              className={`btn-secondary actor-page__like-btn ${director.isLikedByCurrentUser ? "active" : ""}`}
              onClick={() => likeMutation.mutate()}
            >
              <Heart
                size={16}
                fill={director.isLikedByCurrentUser ? "#4a90e2" : "none"}
              />
              {director.isLikedByCurrentUser
                ? t("actor.liked")
                : t("actor.like")}
              {director.likeCount > 0 && (
                <span className="actor-page__like-count">
                  {director.likeCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <h2 className="actor-page__section-title">{t("director.filmography")}</h2>
      <div className="movie-grid">
        {director.filmography.map((m) => (
          <MovieCard key={m.id} movie={m} />
        ))}
      </div>
    </div>
  );
}
