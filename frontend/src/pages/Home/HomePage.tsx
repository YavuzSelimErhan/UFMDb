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
import FriendsActivitySection from "@/components/movie/FriendsActivitySection";
import "./HomePage.css";

const RAIL_SIZE = 15;
// Ana sayfadaki "Koleksiyonlar" bölümünde gösterilecek resmî liste sayısı.
const COLLECTIONS_SIZE = 12;
const CURRENT_YEAR = new Date().getFullYear();
// Trend rail'i için geriye dönük kaç yıl taransın.
const TRENDING_YEARS_BACK = 1;
// "Yakında vizyonda" filtresi için bugünün tarihi (YYYY-MM-DD).
// Yarın (UTC) — "çıkmış" filmleri değil, henüz çıkmamış olanları listelemek için
const TOMORROW_ISO = new Date(Date.now() + 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];

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
  // getAll artık sayfalı sonuç (PagedLists) döndürüyor; ana sayfa için resmî
  // listelerin ilk sayfası yeterli. "lists" öneki, liste oluştur/düzenle/sil
  // sonrası yapılan invalidate ile bu sorguyu da yeniler.
  const { data: listsPage } = useQuery({
    queryKey: ["lists", "home"],
    queryFn: () =>
      listService.getAll({
        scope: "Official",
        sort: "Default",
        page: 1,
        pageSize: COLLECTIONS_SIZE,
      }),
  });
  const lists = listsPage?.items;

  // 'my-profile' key'i zaten RailCard/HeroCarousel'daki watchlist toggle'ların
  // invalidate ettiği key ile aynı, o yüzden bir yerde ekle/çıkar yapınca burası da otomatik güncellenir.
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: profileService.getMyProfile,
    enabled: isAuthenticated,
  });

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
        releaseDateFrom: TOMORROW_ISO,
      }),
  });

  return (
    <div className="home-page">
      {data && data.featured.length > 0 && (
        <HeroCarousel movies={data.featured} />
      )}
      <HomeSearchBar />

      <div className="container home-page__body">
        <FriendsActivitySection />
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

            {isUpcomingLoading && <RailSkeleton />}
            {upcomingMovies && upcomingMovies.items.length > 0 && (
              <ThemedMovieRail
                eyebrow={t("home.upcomingEyebrow")}
                title={t("home.upcoming")}
                movies={upcomingMovies.items}
                theme="neon"
                seeAllHref={`/search?sortBy=releaseDate&sortDirection=asc&releaseDateFrom=${TOMORROW_ISO}`}
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
