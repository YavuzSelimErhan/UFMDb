import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  movieService,
  genreService,
  listService,
  profileService,
} from "@/services";
import { useAppSelector } from "@/store";
import HeroCarousel from "@/components/movie/HeroCarousel";
import ThemedMovieRail from "@/components/movie/ThemedMovieRail";
import Collections from "@/components/movie/Collections";
import GenresSection from "@/components/movie/GenresSection";
import { PageError, RailSkeleton } from "@/components/common/PageState";
import HomeSearchBar from "@/components/movie/HomeSearchBar";
import "./HomePage.css";

export default function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAppSelector((s) => s.auth);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["home-feed"],
    queryFn: movieService.getHomeFeed,
    retry: 1,
  });
  const { data: genres } = useQuery({
    queryKey: ["genres"],
    queryFn: genreService.getAll,
  });
  const { data: lists } = useQuery({
    queryKey: ["lists"],
    queryFn: listService.getAll,
  });

  // 'my-profile' key'i zaten RailCard/HeroCarousel'daki watchlist toggle'ların
  // invalidate ettiği key ile aynı, o yüzden bir yerde ekle/çıkar yapınca burası da otomatik güncellenir.
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: profileService.getMyProfile,
    enabled: isAuthenticated,
  });

  return (
    <div className="home-page">
      {data && data.featured.length > 0 && (
        <HeroCarousel movies={data.featured} />
      )}
      <HomeSearchBar />

      <div className="container home-page__body">
        {isLoading && (
          <>
            <RailSkeleton />
            <RailSkeleton />
            <RailSkeleton />
          </>
        )}

        {isError && !isLoading && (
          <PageError
            message={t("errors.homeFeedFailed")}
            onRetry={() => refetch()}
          />
        )}

        {data && (
          <>
            {isAuthenticated && profile && profile.watchlist.length > 0 && (
              <ThemedMovieRail
                eyebrow={t("home.watchlistEyebrow")}
                title={t("home.watchlist")}
                movies={profile.watchlist}
                theme="teal"
                seeAllHref="/profile"
              />
            )}

            <ThemedMovieRail
              eyebrow={t("home.trendingEyebrow")}
              title={t("home.trending")}
              movies={data.trending}
              theme="neon"
              showRank
              seeAllHref="/search"
            />
            <ThemedMovieRail
              eyebrow={t("home.popularEyebrow")}
              title={t("home.popular")}
              movies={data.popular}
              theme="frost"
              seeAllHref="/search"
            />

            <ThemedMovieRail
              eyebrow={t("home.topRatedEyebrow")}
              title={t("home.topRated")}
              movies={data.topRated}
              theme="gold"
              showRank
              seeAllHref="/search"
            />

            {lists && lists.length > 0 && <Collections lists={lists} />}

            {genres && <GenresSection genres={genres} />}
          </>
        )}
      </div>
    </div>
  );
}
