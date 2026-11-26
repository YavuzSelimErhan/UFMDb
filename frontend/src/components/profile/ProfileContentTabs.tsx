import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
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
  personService,
  movieService,
  listService,
  profileService,
} from "@/services";
import { pickListText } from "@/utils/listText";
import WatchlistTab from "@/components/profile/WatchlistTab";
import MovieCard from "@/components/movie/MovieCard";
import ListCard from "@/pages/Lists/ListCard";
import EditReviewModal from "@/components/profile/EditReviewModal";
import PagedMovieGrid from "@/components/profile/PagedMovieGrid";
import { useScreeningLogModal } from "@/hooks/useScreeningLogModal";
import {
  EmptyState,
  PageSpinner,
  PageError,
} from "@/components/common/PageState";
import type { MovieListItem, PersonListItem, ReviewSummary } from "@/types";
import "./ProfileContentTabs.css";

export type ContentTab = "watchlist" | "liked" | "reviews";
type LikedSubTab = "films" | "actors" | "directors" | "lists" | "reviews";

/** Films sekmesindeki PAGE_SIZE ile aynı: iki yerde aynı ritim. */
const LISTS_PAGE_SIZE = 24;

interface Props {
  tab: ContentTab;
  isOwnProfile: boolean;
  watchlist: MovieListItem[];
  likedMovies: MovieListItem[];
  likedActors: PersonListItem[];
  likedDirectors: PersonListItem[];
  reviews: ReviewSummary[];
}

export default function ProfileContentTabs({
  tab,
  isOwnProfile,
  watchlist,
  likedMovies,
  likedActors,
  likedDirectors,
  reviews,
}: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { openLog, logModal } = useScreeningLogModal();
  const [editingReview, setEditingReview] = useState<ReviewSummary | null>(
    null,
  );
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [likedSubTab, setLikedSubTab] = useState<LikedSubTab>("films");

  const unlikePersonMutation = useMutation({
    mutationFn: (id: string) => personService.toggleLike(id),
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
    data: likedListsData,
    isLoading: isLikedListsLoading,
    isError: isLikedListsError,
    refetch: refetchLikedLists,
    fetchNextPage: fetchMoreLikedLists,
    hasNextPage: hasMoreLikedLists,
    isFetchingNextPage: isFetchingMoreLikedLists,
  } = useInfiniteQuery({
    // "lists" öneki: liste beğeni/oluştur/düzenle sonrası invalidate ile yenilenir.
    queryKey: ["lists", "liked"],
    queryFn: ({ pageParam }) =>
      listService.getAll({
        scope: "Liked",
        sort: "Newest",
        page: pageParam,
        pageSize: LISTS_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined,
    staleTime: 60_000,
    enabled: tab === "liked" && isOwnProfile,
  });

  const likedLists = likedListsData?.pages.flatMap((p) => p.items);
  const likedListsCount = likedListsData?.pages[0]?.totalCount ?? 0;

  const {
    data: likedReviews,
    isLoading: isLikedReviewsLoading,
    isError: isLikedReviewsError,
    refetch: refetchLikedReviews,
  } = useQuery({
    queryKey: ["liked-reviews"],
    queryFn: () => profileService.getLikedReviews(),
    staleTime: 60_000,
    enabled: tab === "liked" && isOwnProfile,
  });

  const likedSubTabs: {
    key: LikedSubTab;
    label: string;
    icon: typeof Film;
    count: number;
  }[] = [
    {
      key: "films",
      label: t("profile.likedFilms"),
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
      label: t("profile.likedLists"),
      icon: ListVideo,
      count: likedListsCount,
    },
  ];

  return (
    <div className="profile-tabs__panel">
      {tab === "watchlist" && (
        <WatchlistTab watchlist={watchlist} isOwnProfile={isOwnProfile} />
      )}

      {tab === "liked" && (
        <div className="profile-tabs">
          <nav className="profile-tabs__nav">
            {likedSubTabs.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                type="button"
                className={`profile-tabs__nav-item ${likedSubTab === key ? "is-active" : ""}`}
                aria-current={likedSubTab === key ? "page" : undefined}
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
                <PagedMovieGrid
                  movies={likedMovies}
                  renderCard={(m) => (
                    <MovieCard
                      movie={m}
                      interactive={isOwnProfile}
                      onUnlike={isOwnProfile ? () => {} : undefined}
                      onLogClick={isOwnProfile ? () => openLog(m) : undefined}
                    />
                  )}
                />
              ) : (
                <EmptyState
                  icon={<Heart size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t(
                    isOwnProfile
                      ? "profile.likedHint"
                      : "profile.likedHintOther",
                  )}
                />
              ))}

            {likedSubTab === "actors" &&
              (likedActors.length > 0 ? (
                <div className="person-card-grid">
                  {likedActors.map((a) => (
                    <div key={a.id} className="person-card">
                      <Link
                        to={`/people/${a.id}`}
                        className="person-card__media"
                      >
                        <img
                          src={a.photoUrl}
                          alt={a.fullName}
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="person-card__scrim" />
                        <span className="person-card__name">{a.fullName}</span>
                      </Link>
                      {isOwnProfile && (
                        <button
                          type="button"
                          className="person-card__unlike"
                          disabled={unlikePersonMutation.isPending}
                          aria-label={t("movie.unlike")}
                          onClick={() => unlikePersonMutation.mutate(a.id)}
                        >
                          <Heart size={13} fill="currentColor" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Users size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t(
                    isOwnProfile
                      ? "profile.likedActorsHint"
                      : "profile.likedActorsHintOther",
                  )}
                />
              ))}

            {likedSubTab === "directors" &&
              (likedDirectors.length > 0 ? (
                <div className="person-card-grid">
                  {likedDirectors.map((d) => (
                    <div key={d.id} className="person-card">
                      <Link to={`/peopleid}`} className="person-card__media">
                        <img
                          src={d.photoUrl}
                          alt={d.fullName}
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="person-card__scrim" />
                        <span className="person-card__name">{d.fullName}</span>
                      </Link>
                      {isOwnProfile && (
                        <button
                          type="button"
                          className="person-card__unlike"
                          disabled={unlikePersonMutation.isPending}
                          aria-label={t("movie.unlike")}
                          onClick={() => unlikePersonMutation.mutate(d.id)}
                        >
                          <Heart size={13} fill="currentColor" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Clapperboard size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t(
                    isOwnProfile
                      ? "profile.likedDirectorsHint"
                      : "profile.likedDirectorsHintOther",
                  )}
                />
              ))}

            {likedSubTab === "reviews" &&
              (!isOwnProfile ? (
                <EmptyState
                  icon={<MessageSquare size={26} />}
                  title={t("profile.notAvailableForOthers")}
                />
              ) : isLikedReviewsLoading ? (
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
                          loading="lazy"
                          decoding="async"
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
                              width={22}
                              height={22}
                              loading="lazy"
                              decoding="async"
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

                      {isOwnProfile && (
                        <button
                          type="button"
                          className="review-entry__like-btn active"
                          disabled={unlikeReviewMutation.isPending}
                          aria-label={t("movie.unlike")}
                          onClick={() => unlikeReviewMutation.mutate(r.id)}
                        >
                          <Heart size={14} fill="currentColor" />
                          {r.likeCount}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<MessageSquare size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t(
                    isOwnProfile
                      ? "profile.likedReviewsHint"
                      : "profile.likedReviewsHintOther",
                  )}
                />
              ))}

            {likedSubTab === "lists" &&
              (!isOwnProfile ? (
                <EmptyState
                  icon={<ListVideo size={26} />}
                  title={t("profile.notAvailableForOthers")}
                />
              ) : isLikedListsLoading ? (
                <PageSpinner label={t("common.loading")} />
              ) : isLikedListsError ? (
                <PageError
                  message={t("errors.listsFailed")}
                  onRetry={() => refetchLikedLists()}
                />
              ) : likedLists && likedLists.length > 0 ? (
                <>
                  <div className="profile-tabs__lists-grid">
                    {likedLists.map((list) => (
                      <ListCard
                        key={list.id}
                        list={list}
                        displayTitle={pickListText(
                          list.titleTr,
                          list.title,
                          i18n.language,
                        )}
                        displayDescription={pickListText(
                          list.descriptionTr,
                          list.description,
                          i18n.language,
                        )}
                      />
                    ))}
                  </div>
                  {hasMoreLikedLists && (
                    <div className="paged-grid__actions">
                      <button
                        type="button"
                        className="paged-grid__more btn-secondary"
                        disabled={isFetchingMoreLikedLists}
                        onClick={() => fetchMoreLikedLists()}
                      >
                        {isFetchingMoreLikedLists
                          ? t("common.loading")
                          : t("profile.loadMore")}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={<ListVideo size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t(
                    isOwnProfile
                      ? "profile.likedListsHint"
                      : "profile.likedListsHintOther",
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
                      loading="lazy"
                      decoding="async"
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

                  {isOwnProfile && (
                    <div className="review-entry__actions">
                      <button
                        type="button"
                        className="review-entry__action-btn"
                        onClick={() => setEditingReview(r)}
                        aria-label={t("common.edit")}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="review-entry__action-btn review-entry__action-btn--danger"
                        onClick={() => setConfirmingDeleteId(r.movieId)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  {confirmingDeleteId === r.movieId && (
                    <div className="review-entry__confirm">
                      <p>{t("profile.confirmDeleteReview")}</p>
                      <div className="review-entry__confirm-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          type="button"
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
            title={t(
              isOwnProfile ? "profile.noReviews" : "profile.noReviewsOther",
            )}
          />
        ))}

      {editingReview && (
        <EditReviewModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
        />
      )}

      {isOwnProfile && logModal}
    </div>
  );
}
