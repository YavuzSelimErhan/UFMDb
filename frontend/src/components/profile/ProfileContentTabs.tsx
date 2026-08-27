import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Heart,
  MessageSquare,
  Users,
  Clapperboard,
  Film,
  ListVideo,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  actorService,
  directorService,
  movieService,
  listService,
  profileService,
} from "@/services";
import MovieCard from "@/components/movie/MovieCard";
import ListCard from "@/pages/Lists/ListCard";
import EditReviewModal from "@/components/profile/EditReviewModal";
import {
  EmptyState,
  PageSpinner,
  PageError,
} from "@/components/common/PageState";
import type {
  MovieListItem,
  ActorListItem,
  DirectorListItem,
  ReviewSummary,
} from "@/types";
import "./ProfileContentTabs.css";

export type ContentTab = "watchlist" | "liked" | "reviews";
type LikedSubTab = "films" | "actors" | "directors" | "lists" | "reviews";

interface Props {
  tab: ContentTab;
  watchlist: MovieListItem[];
  likedMovies: MovieListItem[];
  likedActors: ActorListItem[];
  likedDirectors: DirectorListItem[];
  reviews: ReviewSummary[];
}

export default function ProfileContentTabs({
  tab,
  watchlist,
  likedMovies,
  likedActors,
  likedDirectors,
  reviews,
}: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [editingReview, setEditingReview] = useState<ReviewSummary | null>(
    null,
  );
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [likedSubTab, setLikedSubTab] = useState<LikedSubTab>("films");

  const unlikeActorMutation = useMutation({
    mutationFn: (id: string) => actorService.toggleLike(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });
  const unlikeDirectorMutation = useMutation({
    mutationFn: (id: string) => directorService.toggleLike(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });
  const deleteReviewMutation = useMutation({
    mutationFn: (movieId: string) => movieService.deleteReview(movieId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setConfirmingDeleteId(null);
    },
  });
  const unlikeReviewMutation = useMutation({
    mutationFn: (reviewId: string) => movieService.toggleReviewLike(reviewId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["liked-reviews"] }),
  });

  const {
    data: likedLists,
    isLoading: isLikedListsLoading,
    isError: isLikedListsError,
    refetch: refetchLikedLists,
  } = useQuery({
    queryKey: ["lists", "Liked"],
    queryFn: () => listService.getAll("Liked"),
    staleTime: 60_000,
    enabled: tab === "liked",
  });

  const {
    data: likedReviews,
    isLoading: isLikedReviewsLoading,
    isError: isLikedReviewsError,
    refetch: refetchLikedReviews,
  } = useQuery({
    queryKey: ["liked-reviews"],
    queryFn: () => profileService.getLikedReviews(),
    staleTime: 60_000,
    enabled: tab === "liked",
  });

  const likedSubTabs: {
    key: LikedSubTab;
    label: string;
    icon: typeof Film;
    count: number;
  }[] = [
    {
      key: "films",
      label: t("profile.likedFilms", "Filmler"),
      icon: Film,
      count: likedMovies.length,
    },
    {
      key: "actors",
      label: t("profile.likedActors"),
      icon: Users,
      count: likedActors.length,
    },
    {
      key: "directors",
      label: t("profile.likedDirectors"),
      icon: Clapperboard,
      count: likedDirectors.length,
    },
    {
      key: "reviews",
      label: t("profile.likedReviews"),
      icon: MessageSquare,
      count: likedReviews?.length ?? 0,
    },
    {
      key: "lists",
      label: t("profile.likedLists", "Listeler"),
      icon: ListVideo,
      count: likedLists?.length ?? 0,
    },
  ];

  return (
    <div className="profile-tabs__panel">
      {tab === "watchlist" &&
        (watchlist.length > 0 ? (
          <div className="movie-grid movie-grid--compact">
            {watchlist.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Bookmark size={26} />}
            title={t("profile.emptyContent")}
            hint={t("profile.watchlistHint")}
          />
        ))}

      {tab === "liked" && (
        <div className="profile-tabs">
          <nav className="profile-tabs__nav">
            {likedSubTabs.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                className={`profile-tabs__nav-item ${likedSubTab === key ? "is-active" : ""}`}
                onClick={() => setLikedSubTab(key)}
              >
                <span className="profile-tabs__nav-label">
                  <Icon size={15} /> {label}
                </span>
                <span className="profile-tabs__nav-count">{count}</span>
              </button>
            ))}
          </nav>

          <div className="profile-tabs__panel">
            {likedSubTab === "films" &&
              (likedMovies.length > 0 ? (
                <div className="movie-grid movie-grid--compact">
                  {likedMovies.map((m) => (
                    <MovieCard key={m.id} movie={m} onUnlike={() => {}} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Heart size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t("profile.likedHint")}
                />
              ))}

            {likedSubTab === "actors" &&
              (likedActors.length > 0 ? (
                <div className="person-card-grid">
                  {likedActors.map((a) => (
                    <div key={a.id} className="person-card">
                      <Link
                        to={`/actors/${a.id}`}
                        className="person-card__media"
                      >
                        <img src={a.photoUrl} alt={a.fullName} />
                        <div className="person-card__scrim" />
                        <span className="person-card__name">{a.fullName}</span>
                      </Link>
                      <button
                        className="person-card__unlike"
                        disabled={unlikeActorMutation.isPending}
                        aria-label={t("movie.unlike")}
                        onClick={() => unlikeActorMutation.mutate(a.id)}
                      >
                        <Heart size={13} fill="currentColor" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Users size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t(
                    "profile.likedActorsHint",
                    "Henüz beğendiğin bir oyuncu yok.",
                  )}
                />
              ))}

            {likedSubTab === "directors" &&
              (likedDirectors.length > 0 ? (
                <div className="person-card-grid">
                  {likedDirectors.map((d) => (
                    <div key={d.id} className="person-card">
                      <Link
                        to={`/directors/${d.id}`}
                        className="person-card__media"
                      >
                        <img src={d.photoUrl} alt={d.fullName} />
                        <div className="person-card__scrim" />
                        <span className="person-card__name">{d.fullName}</span>
                      </Link>
                      <button
                        className="person-card__unlike"
                        disabled={unlikeDirectorMutation.isPending}
                        aria-label={t("movie.unlike")}
                        onClick={() => unlikeDirectorMutation.mutate(d.id)}
                      >
                        <Heart size={13} fill="currentColor" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Clapperboard size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t(
                    "profile.likedDirectorsHint",
                    "Henüz beğendiğin bir yönetmen yok.",
                  )}
                />
              ))}

            {likedSubTab === "reviews" &&
              (isLikedReviewsLoading ? (
                <PageSpinner label={t("common.loading")} />
              ) : isLikedReviewsError ? (
                <PageError
                  message={t("errors.listsFailed")}
                  onRetry={() => refetchLikedReviews()}
                />
              ) : likedReviews && likedReviews.length > 0 ? (
                <div className="review-journal">
                  {likedReviews.map((r) => (
                    <div
                      key={r.id}
                      className="review-entry review-entry--liked card"
                    >
                      <Link
                        to={`/movies/${r.movieId}`}
                        className="review-entry__poster-link"
                      >
                        <img
                          src={r.posterUrl}
                          alt={r.movieTitle}
                          className="review-entry__poster"
                        />
                      </Link>

                      <div className="review-entry__body">
                        <div className="review-entry__header">
                          <Link
                            to={`/movies/${r.movieId}`}
                            className="review-entry__title"
                          >
                            {r.movieTitle}
                          </Link>
                          {r.containsSpoiler && (
                            <span className="review-entry__spoiler-badge">
                              <AlertTriangle size={11} /> {t("movie.spoiler")}
                            </span>
                          )}
                        </div>

                        <div className="review-entry__reviewer">
                          {r.userAvatarUrl ? (
                            <img
                              src={r.userAvatarUrl}
                              alt=""
                              className="review-entry__reviewer-avatar"
                            />
                          ) : (
                            <span className="review-entry__reviewer-avatar review-entry__reviewer-avatar--fallback">
                              <Users size={11} />
                            </span>
                          )}
                          <span className="review-entry__reviewer-name">
                            {r.userName}
                          </span>
                        </div>

                        {r.content && (
                          <p className="review-entry__content">{r.content}</p>
                        )}
                      </div>

                      <button
                        className="review-entry__like-btn active"
                        disabled={unlikeReviewMutation.isPending}
                        aria-label={t("movie.unlike")}
                        onClick={() => unlikeReviewMutation.mutate(r.id)}
                      >
                        <Heart size={14} fill="currentColor" />
                        {r.likeCount}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<MessageSquare size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t(
                    "profile.likedReviewsHint",
                    "Henüz beğendiğin bir yorum yok.",
                  )}
                />
              ))}

            {likedSubTab === "lists" &&
              (isLikedListsLoading ? (
                <PageSpinner label={t("common.loading")} />
              ) : isLikedListsError ? (
                <PageError
                  message={t("errors.listsFailed")}
                  onRetry={() => refetchLikedLists()}
                />
              ) : likedLists && likedLists.length > 0 ? (
                <div className="profile-tabs__lists-grid">
                  {likedLists.map((list) => (
                    <ListCard
                      key={list.id}
                      list={list}
                      displayTitle={
                        i18n.language === "tr" ? list.titleTr : list.title
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<ListVideo size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t(
                    "profile.likedListsHint",
                    "Henüz beğendiğin bir liste yok.",
                  )}
                />
              ))}
          </div>
        </div>
      )}

      {tab === "reviews" &&
        (reviews.length > 0 ? (
          <div className="review-journal">
            {reviews.map((r) => {
              const date = new Date(r.createdAtUtc);
              return (
                <div key={r.id} className="review-entry card">
                  <div className="review-entry__date">
                    <span className="review-entry__day">{date.getDate()}</span>
                    <span className="review-entry__month">
                      {date.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="review-entry__year">
                      {date.getFullYear()}
                    </span>
                  </div>

                  <div className="review-entry__divider" />

                  <Link
                    to={`/movies/${r.movieId}`}
                    className="review-entry__poster-link"
                  >
                    <img
                      src={r.posterUrl}
                      alt={r.movieTitle}
                      className="review-entry__poster"
                    />
                  </Link>

                  <div className="review-entry__body">
                    <div className="review-entry__header">
                      <Link
                        to={`/movies/${r.movieId}`}
                        className="review-entry__title"
                      >
                        {r.movieTitle}
                      </Link>
                      {r.containsSpoiler && (
                        <span className="review-entry__spoiler-badge">
                          <AlertTriangle size={11} /> {t("movie.spoiler")}
                        </span>
                      )}
                    </div>
                    {r.content && (
                      <p className="review-entry__content">{r.content}</p>
                    )}
                  </div>

                  <div className="review-entry__actions">
                    <button
                      className="review-entry__action-btn"
                      onClick={() => setEditingReview(r)}
                      aria-label={t("common.edit")}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="review-entry__action-btn review-entry__action-btn--danger"
                      onClick={() => setConfirmingDeleteId(r.movieId)}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {confirmingDeleteId === r.movieId && (
                    <div className="review-entry__confirm">
                      <p>{t("profile.confirmDeleteReview")}</p>
                      <div className="review-entry__confirm-actions">
                        <button
                          className="btn-secondary"
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          className="review-entry__confirm-delete"
                          disabled={deleteReviewMutation.isPending}
                          onClick={() => deleteReviewMutation.mutate(r.movieId)}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<MessageSquare size={26} />}
            title={t("profile.noReviews")}
          />
        ))}

      {editingReview && (
        <EditReviewModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
        />
      )}
    </div>
  );
}
