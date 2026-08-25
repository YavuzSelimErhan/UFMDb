import { useMemo } from "react";
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

const RAIL_SIZE = 15;
const CURRENT_YEAR = new Date().getFullYear();
// Trend rail'i için geriye dönük kaç yıl taransın.
const TRENDING_YEARS_BACK = 1;
// "Yakında vizyonda" filtresi için bugünün tarihi (YYYY-MM-DD).
const TODAY_ISO = new Date().toISOString().split("T")[0];

export default function HomePage() {
  const { t, i18n } = useTranslation();
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

  // Kullanıcının son izlediği filmlerdeki türleri sayıp en sık geçeni buluyoruz.
  // Ayrı bir backend endpoint'i gerekmiyor; recentlyWatched zaten profile ile geliyor.
  const topGenre = useMemo(() => {
    if (!profile?.recentlyWatched?.length) return null;
    const counts = new Map<string, number>();
    profile.recentlyWatched.forEach(({ movie }) => {
      movie.genres.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1));
    });
    let top: string | null = null;
    let max = 0;
    counts.forEach((count, genre) => {
      if (count > max) {
        max = count;
        top = genre;
      }
    });
    return top;
  }, [profile?.recentlyWatched]);

  const genreLabel = (name: string) => {
    const match = genres?.find((g) => g.name === name || g.nameTr === name);
    return match ? (i18n.language === "tr" ? match.nameTr : match.name) : name;
  };

  // Popüler: tüm zamanlar, oy sayısına göre (backend'de RatingCount bazlı sıralıyor).
  const { data: popularMovies, isLoading: isPopularLoading } = useQuery({
    queryKey: ["home-popular"],
    queryFn: () =>
      movieService.search({
        page: 1,
        pageSize: RAIL_SIZE,
        sortBy: "popularity",
        sortDirection: "desc",
      }),
  });

  // Trend: son N yılın en yüksek oy sayılı filmleri.
  const { data: trendingMovies, isLoading: isTrendingLoading } = useQuery({
    queryKey: ["home-trending", TRENDING_YEARS_BACK],
    queryFn: () =>
      movieService.search({
        page: 1,
        pageSize: RAIL_SIZE,
        sortBy: "popularity",
        sortDirection: "desc",
        yearFrom: CURRENT_YEAR - TRENDING_YEARS_BACK,
      }),
  });

  const { data: newestMovies, isLoading: isNewestLoading } = useQuery({
    queryKey: ["home-newest"],
    queryFn: () =>
      movieService.search({
        page: 1,
        pageSize: RAIL_SIZE,
        sortBy: "newest",
        sortDirection: "desc",
      }),
  });

  // Yakında vizyonda: gerçek vizyon tarihi bugünden sonra olan filmler.
  // Backend'de MovieSearchQueryDto.ReleaseDateFrom + "releaseDate" sortBy case'i eklendikten sonra çalışır.
  const { data: upcomingMovies, isLoading: isUpcomingLoading } = useQuery({
    queryKey: ["home-upcoming"],
    queryFn: () =>
      movieService.search({
        page: 1,
        pageSize: RAIL_SIZE,
        sortBy: "releaseDate",
        sortDirection: "asc",
        releaseDateFrom: TODAY_ISO,
      }),
  });

  const { data: genreMovies, isLoading: isGenreLoading } = useQuery({
    queryKey: ["home-genre", topGenre],
    queryFn: () =>
      movieService.search({
        page: 1,
        pageSize: RAIL_SIZE,
        sortBy: "rating",
        sortDirection: "desc",
        genre: topGenre!,
      }),
    enabled: !!topGenre,
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
                seeAllHref="/profile?tab=watchlist"
              />
            )}

            {isTrendingLoading && <RailSkeleton />}
            {trendingMovies && trendingMovies.items.length > 0 && (
              <ThemedMovieRail
                eyebrow={t("home.trendingEyebrow")}
                title={t("home.trending")}
                movies={trendingMovies.items}
                theme="neon"
                showRank
                seeAllHref={`/search?sortBy=popularity&sortDirection=desc&yearFrom=${CURRENT_YEAR - TRENDING_YEARS_BACK}`}
              />
            )}

            <ThemedMovieRail
              eyebrow={t("home.topRatedEyebrow")}
              title={t("home.topRated")}
              movies={data.topRated}
              theme="gold"
              showRank
              seeAllHref="/search?sortBy=rating&sortDirection=desc"
            />

            {isPopularLoading && <RailSkeleton />}
            {popularMovies && popularMovies.items.length > 0 && (
              <ThemedMovieRail
                eyebrow={t("home.popularEyebrow")}
                title={t("home.popular")}
                movies={popularMovies.items}
                theme="frost"
                showRank
                seeAllHref="/search?sortBy=popularity&sortDirection=desc"
              />
            )}

            {isGenreLoading && <RailSkeleton />}
            {genreMovies && genreMovies.items.length > 0 && topGenre && (
              <ThemedMovieRail
                eyebrow={t("home.genreEyebrow")}
                title={genreLabel(topGenre)}
                movies={genreMovies.items}
                theme="crimson"
                seeAllHref={`/search?genre=${encodeURIComponent(topGenre)}&sortBy=rating&sortDirection=desc`}
              />
            )}

            {isNewestLoading && <RailSkeleton />}
            {newestMovies && newestMovies.items.length > 0 && (
              <ThemedMovieRail
                eyebrow={t("home.newestEyebrow")}
                title={t("home.newest")}
                movies={newestMovies.items}
                theme="frost"
                seeAllHref="/search?sortBy=newest&sortDirection=desc"
              />
            )}

            {isUpcomingLoading && <RailSkeleton />}
            {upcomingMovies && upcomingMovies.items.length > 0 && (
              <ThemedMovieRail
                eyebrow={t("home.upcomingEyebrow")}
                title={t("home.upcoming")}
                movies={upcomingMovies.items}
                theme="neon"
                seeAllHref={`/search?sortBy=releaseDate&sortDirection=asc&releaseDateFromUtc=${TODAY_ISO}`}
              />
            )}

            {lists && lists.length > 0 && <Collections lists={lists} />}

            {genres && <GenresSection genres={genres} />}
          </>
        )}
      </div>
    </div>
  );
}
