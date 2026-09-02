import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Clock,
  Settings2,
  Moon,
  Sun,
  Bookmark,
  Pencil,
  Heart,
  MessageSquare,
  Film,
  ArrowRight,
  Languages,
  ListVideo,
  Plus,
} from "lucide-react";
import { profileService, listService } from "@/services";
import { useAppDispatch, useAppSelector } from "@/store";
import { setTheme } from "@/store/uiSlice";
import { SUPPORTED_LANGUAGES, languageLabel } from "@/i18n/languages";
import Dropdown from "@/components/search/Dropdown";
import MovieCard from "@/components/movie/MovieCard";
import ListCard from "./../Lists/ListCard";
import FavoritesShowcase from "@/components/profile/FavoritesShowcase";
import ProfileFilmsTab from "@/components/profile/ProfileFilmsTab";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileContentTabs from "@/components/profile/ProfileContentTabs";
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

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as ProfileTab) || "profile";

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
    data: myLists,
    isLoading: isMyListsLoading,
    isError: isMyListsError,
    refetch: refetchMyLists,
  } = useQuery({
    queryKey: ["lists", "Mine"],
    queryFn: () => listService.getAll("Mine"),
    staleTime: 60_000,
  });

  const { data: filmsCounts } = useWatchedFilmsCounts();

  const settingsMutation = useMutation({
    mutationFn: ({ language, theme }: { language: string; theme: string }) =>
      profileService.updateSettings(language, theme),
  });

  const handleThemeChange = (value: "dark" | "light") => {
    dispatch(setTheme(value));
    settingsMutation.mutate({ language: i18n.language, theme: value });
  };

  const handleLangChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem("ufmdb_language", value);
    settingsMutation.mutate({ language: value, theme });
  };

  const languageOptions = SUPPORTED_LANGUAGES.map((lng) => ({
    label: languageLabel(lng),
    value: lng,
  }));

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
      count: filmsCounts?.all,
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
      count: myLists?.length,
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
        onEditClick={() => navigate("/profile/edit")}
        listsCount={myLists?.length}
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
            <FavoritesShowcase
              movies={profile.favoriteMovies}
              actors={profile.favoriteActors}
              directors={profile.favoriteDirectors}
            />
            <section className="profile-page__section">
              <h2>
                <Clock size={17} />
                {t("profile.recentlyWatched")}
              </h2>
              {profile.recentlyWatched.length > 0 ? (
                <>
                  <div className="movie-grid movie-grid--compact">
                    {profile.recentlyWatched.map((item) => (
                      <MovieCard
                        key={item.movie.id}
                        movie={item.movie}
                        userRating={item.userRating}
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

        {tab === "films" && <ProfileFilmsTab />}

        {(tab === "watchlist" || tab === "liked" || tab === "reviews") && (
          <ProfileContentTabs
            tab={tab}
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
              <div className="lists-page__grid">
                {myLists.map((list) => (
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

        {tab === "settings" && (
          <section className="profile-page__settings card">
            <div className="profile-page__setting-row">
              <span>{t("profile.theme")}</span>
              <div className="profile-page__toggle-group">
                <button
                  className={theme === "dark" ? "active" : ""}
                  onClick={() => handleThemeChange("dark")}
                >
                  <Moon size={14} /> Dark
                </button>
                <button
                  className={theme === "light" ? "active" : ""}
                  onClick={() => handleThemeChange("light")}
                >
                  <Sun size={14} /> Light
                </button>
              </div>
            </div>
            <div className="profile-page__setting-row">
              <span>{t("profile.language")}</span>
              <Dropdown
                icon={<Languages size={14} />}
                value={i18n.language}
                options={languageOptions}
                onChange={handleLangChange}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
