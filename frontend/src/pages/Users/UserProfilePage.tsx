import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Clock,
  Bookmark,
  Heart,
  MessageSquare,
  Film,
  ListVideo,
  User as UserIcon,
} from "lucide-react";
import { followService } from "@/services";
import MovieCard from "@/components/movie/MovieCard";
import ListCard from "../Lists/ListCard";
import Favorites from "@/components/profile/Favorites";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileContentTabs from "@/components/profile/ProfileContentTabs";
import UserFilmsTab from "@/components/profile/UserFilmsTab";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import "../Profile/ProfilePage.css";

type ProfileTab =
  | "profile"
  | "films"
  | "watchlist"
  | "liked"
  | "reviews"
  | "lists";

export default function UserProfilePage() {
  const { userName = "" } = useParams<{ userName: string }>();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tab = (searchParams.get("tab") as ProfileTab) || "profile";

  const setTab = (next: ProfileTab) => {
    const n = new URLSearchParams(searchParams);
    if (next === "profile") n.delete("tab");
    else n.set("tab", next);
    setSearchParams(n);
  };

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["user-profile", userName],
    queryFn: () => followService.getFullProfileByUserName(userName),
    enabled: !!userName,
    retry: 1,
    staleTime: 60_000,
  });

  const {
    data: userLists,
    isLoading: isListsLoading,
    isError: isListsError,
    refetch: refetchLists,
  } = useQuery({
    queryKey: ["user-lists", profile?.id],
    queryFn: () => followService.getUserLists(profile!.id),
    enabled: !!profile?.id,
    staleTime: 60_000,
  });

  const followMutation = useMutation({
    mutationFn: () => followService.toggleFollow(profile!.id),
    onSuccess: (isFollowedNow) => {
      queryClient.setQueryData(
        ["user-profile", userName],
        (prev: typeof profile) =>
          prev && {
            ...prev,
            isFollowedByCurrentUser: isFollowedNow,
            followerCount: prev.followerCount + (isFollowedNow ? 1 : -1),
          },
      );
    },
  });

  if (isLoading) return <PageSpinner label={t("common.loading")} />;

  if (isError || !profile) {
    return (
      <PageError
        message={t("errors.profileFailed")}
        onRetry={() => refetch()}
      />
    );
  }

  const tabs: {
    key: ProfileTab;
    label: string;
    icon: typeof Film;
    count?: number;
  }[] = [
    { key: "profile", label: t("profile.tabProfile"), icon: UserIcon },
    {
      key: "films",
      label: t("profile.tabFilms"),
      icon: Film,
      count: profile.totalWatchedCount,
    },
    {
      key: "watchlist",
      label: t("profile.watchlist"),
      icon: Bookmark,
      count: profile.watchlist.length,
    },
    {
      key: "liked",
      label: t("profile.liked"),
      icon: Heart,
      count:
        profile.likedMovies.length +
        profile.likedActors.length +
        profile.likedDirectors.length,
    },
    {
      key: "lists",
      label: t("profile.myLists"),
      icon: ListVideo,
      count: userLists?.length,
    },
    {
      key: "reviews",
      label: t("profile.reviews"),
      icon: MessageSquare,
      count: profile.reviews.length,
    },
  ];

  return (
    <div className="container profile-page">
      <ProfileHeader
        profile={profile}
        userId={profile.id}
        isCurrentUser={profile.isCurrentUser}
        isFollowedByCurrentUser={profile.isFollowedByCurrentUser}
        onFollowToggle={() => followMutation.mutate()}
        isFollowLoading={followMutation.isPending}
        listsCount={userLists?.length}
      />

      <nav className="profile-page__toptabs">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            className={`profile-page__toptab ${tab === key ? "is-active" : ""}`}
            onClick={() => setTab(key)}
          >
            <Icon size={15} /> {label}
            {count !== undefined && (
              <span className="profile-page__toptab-count">{count}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="profile-page__tabcontent">
        {tab === "profile" && (
          <>
            <Favorites
              movies={profile.favoriteMovies}
              actors={profile.favoriteActors}
              directors={profile.favoriteDirectors}
              isOwnProfile={profile.isCurrentUser}
            />
            <section className="profile-page__section">
              <h2>
                <Clock size={17} />
                {t("profile.recentlyWatched")}
              </h2>
              {profile.recentlyWatched.length > 0 ? (
                <div className="movie-grid movie-grid--compact">
                  {profile.recentlyWatched.map((item) => (
                    <MovieCard
                      key={item.movie.id}
                      movie={item.movie}
                      userRating={item.userRating}
                      interactive={profile.isCurrentUser}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Clock size={26} />}
                  title={t("profile.emptyContent")}
                  hint={t("profile.recentlyWatchedHint")}
                />
              )}
            </section>
          </>
        )}

        {tab === "films" && <UserFilmsTab userId={profile.id} />}

        {(tab === "watchlist" || tab === "liked" || tab === "reviews") && (
          <ProfileContentTabs
            tab={tab}
            isOwnProfile={profile.isCurrentUser}
            watchlist={profile.watchlist}
            likedMovies={profile.likedMovies}
            likedActors={profile.likedActors}
            likedDirectors={profile.likedDirectors}
            reviews={profile.reviews}
          />
        )}

        {tab === "lists" && (
          <section className="profile-page__section">
            <div className="profile-page__section-header">
              <h2>
                <ListVideo size={17} />
                {t("profile.myLists")}
              </h2>
            </div>

            {isListsLoading && <PageSpinner label={t("common.loading")} />}

            {isListsError && !isListsLoading && (
              <PageError
                message={t("errors.listsFailed")}
                onRetry={() => refetchLists()}
              />
            )}

            {userLists && userLists.length === 0 && (
              <EmptyState
                icon={<ListVideo size={26} />}
                title={t("profile.emptyContent")}
              />
            )}

            {userLists && userLists.length > 0 && (
              <div className="lists-page__grid">
                {userLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    displayTitle={
                      i18n.language === "tr" ? list.titleTr : list.title
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
