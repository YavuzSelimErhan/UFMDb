import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Clock,
  Settings2,
  Bookmark,
  Pencil,
  Heart,
  MessageSquare,
  Film,
  ArrowRight,
  ListVideo,
  Plus,
} from "lucide-react";
import { profileService, listService } from "@/services";
import { pickListText } from "@/utils/listText";
import MovieCard from "@/components/movie/MovieCard";
import { useScreeningLogModal } from "@/hooks/useScreeningLogModal";
import ListCard from "./../Lists/ListCard";
import Favorites from "@/components/profile/Favorites";
import FilmsTab from "@/components/profile/FilmsTab";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileContentTabs from "@/components/profile/ProfileContentTabs";
import SettingsTab from "@/components/profile/SettingsTab";
import { useWatchedFilmsCounts } from "@/hooks/useWatchedFilmsCounts";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import "./ProfilePage.css";

type ProfileTab =
  | "profile"
  | "films"
  | "watchlist"
  | "liked"
  | "reviews"
  | "lists"
  | "settings";

const LISTS_PAGE_SIZE = 24;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as ProfileTab) || "profile";
  const { openLog, logModal } = useScreeningLogModal();

  const setTab = (next: ProfileTab) => {
    const n = new URLSearchParams(searchParams);
    if (next === "profile") n.delete("tab");
    else n.set("tab", next);
    // Tab değişince Films sekmesine ait filtre/sıralama/sayfa param'larını taşımıyoruz
    n.delete("ff");
    n.delete("fs");
    n.delete("fv");
    n.delete("fp");
    setSearchParams(n);
  };

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-profile"],
    queryFn: profileService.getMyProfile,
    retry: 1,
    staleTime: 60_000,
  });

  const {
    data: myListsData,
    isLoading: isMyListsLoading,
    isError: isMyListsError,
    refetch: refetchMyLists,
    fetchNextPage: fetchMoreMyLists,
    hasNextPage: hasMoreMyLists,
    isFetchingNextPage: isFetchingMoreMyLists,
  } = useInfiniteQuery({
    // "lists" öneki: Create/Edit sayfalarındaki invalidate bunu da yeniler.
    queryKey: ["lists", "mine"],
    queryFn: ({ pageParam }) =>
      listService.getAll({
        scope: "Mine",
        sort: "Newest",
        page: pageParam,
        pageSize: LISTS_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined,
    staleTime: 60_000,
  });

  const myLists = myListsData?.pages.flatMap((p) => p.items);
  // Sayaç: sunucudaki toplam (yüklenen sayfa sayısı değil).
  const myListsCount = myListsData?.pages[0]?.totalCount;

  // Cache, ProfileHeader içinde profil verisiyle seed ediliyor; bu hook
  // aynı cache'i okuduğu için ek istek atmıyor.
  const { data: filmsCounts } = useWatchedFilmsCounts();

  if (isLoading) return <PageSpinner label={t("common.loading")} />;

  if (isError || !profile) {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    const message =
      status === 401 ? t("errors.sessionExpired") : t("errors.profileFailed");
    return <PageError message={message} onRetry={() => refetch()} />;
  }

  const tabs: {
    key: ProfileTab;
    label: string;
    icon: typeof Film;
    count?: number;
  }[] = [
    { key: "profile", label: t("profile.tabProfile"), icon: Pencil },
    {
      key: "films",
      label: t("profile.tabFilms"),
      icon: Film,
      count: filmsCounts?.all ?? profile.watchedCounts?.all,
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
      count: myListsCount,
    },
    {
      key: "reviews",
      label: t("profile.reviews"),
      icon: MessageSquare,
      count: profile.reviews.length,
    },
    { key: "settings", label: t("profile.settings"), icon: Settings2 },
  ];

  return (
    <div className="container profile-page">
      <ProfileHeader
        profile={profile}
        userId={profile.userId}
        isCurrentUser
        onEditClick={() => navigate("/profile/edit")}
        listsCount={myListsCount}
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
              isOwnProfile
            />
            <section className="profile-page__section">
              <h2>
                <Clock size={17} />
                {t("profile.recentlyWatched")}
              </h2>
              {profile.recentlyWatched.length > 0 ? (
                <>
                  <div className="rw-grid">
                    {profile.recentlyWatched.map((item) => (
                      <MovieCard
                        key={item.movie.id}
                        movie={item.movie}
                        userRating={item.userRating}
                        compact
                        showReaction
                        onLogClick={() => openLog(item.movie)}
                      />
                    ))}
                  </div>
                  <Link to="/log" className="profile-page__view-log">
                    {t("log.viewFullLog")} <ArrowRight size={12} />
                  </Link>
                </>
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

        {tab === "films" && <FilmsTab />}

        {(tab === "watchlist" || tab === "liked" || tab === "reviews") && (
          <ProfileContentTabs
            tab={tab}
            isOwnProfile={true}
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
              <Link
                to="/lists/new"
                className="btn-secondary profile-page__create-list"
              >
                <Plus size={14} /> {t("lists.createList")}
              </Link>
            </div>

            {isMyListsLoading && <PageSpinner label={t("common.loading")} />}

            {isMyListsError && !isMyListsLoading && (
              <PageError
                message={t("errors.listsFailed")}
                onRetry={() => refetchMyLists()}
              />
            )}

            {myLists && myLists.length === 0 && (
              <EmptyState
                icon={<ListVideo size={26} />}
                title={t("profile.emptyContent")}
                hint={t("lists.myListsHint")}
              />
            )}

            {myLists && myLists.length > 0 && (
              <>
                <div className="lists-page__grid">
                  {myLists.map((list) => (
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
                {hasMoreMyLists && (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isFetchingMoreMyLists}
                      onClick={() => fetchMoreMyLists()}
                    >
                      {isFetchingMoreMyLists
                        ? t("common.loading")
                        : t("profile.loadMore")}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {tab === "settings" && (
          <SettingsTab diaryVisibility={profile.diaryVisibility ?? "Public"} />
        )}
      </div>
      {logModal}
    </div>
  );
}
