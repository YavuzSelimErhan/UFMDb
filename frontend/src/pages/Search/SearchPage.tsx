import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search as SearchIcon,
  Film,
  Users,
  Clapperboard,
  X,
} from "lucide-react";
import {
  movieService,
  genreService,
  actorService,
  directorService,
} from "@/services";
import MovieCard from "@/components/movie/MovieCard";
import YearPicker from "@/components/search/YearPicker";
import Pagination from "@/components/common/Pagination";
import Dropdown from "@/components/search/Dropdown";
import StarRatingPicker from "@/components/search/StarRatingPicker";
import {
  MovieGridSkeleton,
  EmptyState,
  PageError,
} from "@/components/common/PageState";
import type {
  MovieSearchFilter,
  PagedResult,
  ActorListItem,
  DirectorListItem,
} from "@/types";
import "./SearchPage.css";

const SORT_OPTIONS = [
  {
    labelKey: "search.sortPopularityDesc",
    sortBy: "popularity",
    sortDirection: "desc",
  },
  {
    labelKey: "search.sortRatingDesc",
    sortBy: "rating",
    sortDirection: "desc",
  },
  { labelKey: "search.sortRatingAsc", sortBy: "rating", sortDirection: "asc" },
  {
    labelKey: "search.sortNewestAdded",
    sortBy: "newest",
    sortDirection: "desc",
  },
  { labelKey: "search.sortYearDesc", sortBy: "year", sortDirection: "desc" },
  { labelKey: "search.sortYearAsc", sortBy: "year", sortDirection: "asc" },
  { labelKey: "search.sortNameAsc", sortBy: "title", sortDirection: "asc" },
  { labelKey: "search.sortNameDesc", sortBy: "title", sortDirection: "desc" },
] as const;

type Tab = "movies" | "actors" | "directors";

interface TabTheme {
  accent: string;
  dim: string;
  glow: string;
  icon: typeof Film;
}

const THEME: Record<Tab, TabTheme> = {
  movies: {
    accent: "#d4af37",
    dim: "rgba(212,175,55,0.14)",
    glow: "rgba(212,175,55,0.35)",
    icon: Film,
  },
  actors: {
    accent: "#4a90e2",
    dim: "rgba(74,144,226,0.14)",
    glow: "rgba(74,144,226,0.30)",
    icon: Users,
  },
  directors: {
    accent: "#00ff88",
    dim: "rgba(0,255,136,0.12)",
    glow: "rgba(0,255,136,0.35)",
    icon: Clapperboard,
  },
};

const TABS: { key: Tab; labelKey: string }[] = [
  { key: "movies", labelKey: "search.moviesTab" },
  { key: "actors", labelKey: "search.actorsTab" },
  { key: "directors", labelKey: "search.directorsTab" },
];

export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("movies");
  const theme = THEME[tab];

  // ---- Film state ----
  const [filter, setFilter] = useState<MovieSearchFilter>({
    page: 1,
    pageSize: 25,
    sortBy: "popularity",
    sortDirection: "desc",
    genre: searchParams.get("genre") ?? undefined,
    title: searchParams.get("title") ?? undefined,
  });

  // ---- Oyuncu state ----
  const [actorQuery, setActorQuery] = useState("");
  const [actorPage, setActorPage] = useState(1);

  // ---- Yönetmen state ----
  const [directorQuery, setDirectorQuery] = useState("");
  const [directorPage, setDirectorPage] = useState(1);

  const { data: genres } = useQuery({
    queryKey: ["genres"],
    queryFn: genreService.getAll,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["movie-search", filter],
    queryFn: () => movieService.search(filter),
    enabled: tab === "movies",
    retry: 1,
  });

  const { data: actorResults, isLoading: isActorLoading } = useQuery({
    queryKey: ["actor-search", actorQuery, actorPage],
    queryFn: () => actorService.search(actorQuery, actorPage, 24),
    enabled: tab === "actors",
  });

  const { data: directorResults, isLoading: isDirectorLoading } = useQuery({
    queryKey: ["director-search", directorQuery, directorPage],
    queryFn: () => directorService.search(directorQuery, directorPage, 24),
    enabled: tab === "directors",
  });

  const update = (patch: Partial<MovieSearchFilter>) =>
    setFilter((f) => ({ ...f, ...patch, page: 1 }));
  const goToPage = (page: number) => {
    setFilter((f) => ({ ...f, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSortChange = (value: string) => {
    const opt = SORT_OPTIONS.find(
      (o) => `${o.sortBy}-${o.sortDirection}` === value,
    );
    if (opt) update({ sortBy: opt.sortBy, sortDirection: opt.sortDirection });
  };

  const genreLabel = (name?: string) => {
    if (!name) return "";
    const match = genres?.find((g) => g.name === name || g.nameTr === name);
    return match ? (i18n.language === "tr" ? match.nameTr : match.name) : name;
  };

  const yearLabel = filter.year
    ? String(filter.year)
    : filter.yearFrom
      ? `${filter.yearFrom}s`
      : null;

  const activeChips = [
    filter.title && {
      key: "title",
      label: `"${filter.title}"`,
      onRemove: () => update({ title: undefined }),
    },
    filter.genre && {
      key: "genre",
      label: genreLabel(filter.genre),
      onRemove: () => update({ genre: undefined }),
    },
    yearLabel && {
      key: "year",
      label: yearLabel,
      onRemove: () =>
        update({ year: undefined, yearFrom: undefined, yearTo: undefined }),
    },
    filter.minRating && {
      key: "rating",
      label: `★ ${filter.minRating}+`,
      onRemove: () => update({ minRating: undefined }),
    },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  // Aktif tab'a göre tek arama kutusunun bağlı olduğu state
  const currentQuery =
    tab === "movies"
      ? (filter.title ?? "")
      : tab === "actors"
        ? actorQuery
        : directorQuery;

  const currentPlaceholder =
    tab === "movies"
      ? t("search.titlePlaceholder")
      : tab === "actors"
        ? t("search.actorSearchPlaceholder")
        : t("search.directorSearchPlaceholder");

  const handleQueryChange = (value: string) => {
    if (tab === "movies") {
      update({ title: value || undefined });
    } else if (tab === "actors") {
      setActorQuery(value);
      setActorPage(1);
    } else {
      setDirectorQuery(value);
      setDirectorPage(1);
    }
  };

  const cssVars = {
    "--tab-accent": theme.accent,
    "--tab-dim": theme.dim,
    "--tab-glow": theme.glow,
  } as React.CSSProperties;

  return (
    <div className="container search-page" style={cssVars}>
      <div className="spotlight-card">
        <div className="spotlight-card__glow" />
        <div className="spotlight-card__inner">
          <div className="spotlight-card__top">
            <div className="spotlight-card__heading">
              <h1>
                <theme.icon
                  size={22}
                  className="spotlight-card__heading-icon"
                />
                {t("search.title")}
              </h1>
              <p>{t("search.subtitle")}</p>
            </div>

            <div className="spotlight-card__tabs">
              {TABS.map(({ key, labelKey }) => {
                const TabIcon = THEME[key].icon;
                return (
                  <button
                    key={key}
                    className={tab === key ? "active" : ""}
                    style={
                      tab === key
                        ? { backgroundColor: THEME[key].accent }
                        : undefined
                    }
                    onClick={() => setTab(key)}
                  >
                    <TabIcon size={14} /> {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="spotlight-card__search">
            <SearchIcon size={17} />
            <input
              autoFocus={tab !== "movies"}
              placeholder={currentPlaceholder}
              value={currentQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
            />
          </div>

          {tab === "movies" && (
            <div className="spotlight-card__filters">
              <Dropdown
                value={filter.genre ?? ""}
                onChange={(v) => update({ genre: v || undefined })}
                options={[
                  { label: t("search.allGenres"), value: "" },
                  ...(genres?.map((g) => ({
                    label: i18n.language === "tr" ? g.nameTr : g.name,
                    value: i18n.language === "tr" ? g.nameTr : g.name,
                  })) ?? []),
                ]}
              />
              <YearPicker
                value={filter.year}
                decadeValue={filter.yearFrom}
                onChangeYear={(year) =>
                  update({ year, yearFrom: undefined, yearTo: undefined })
                }
                onChangeDecade={(decadeStart) =>
                  update({
                    year: undefined,
                    yearFrom: decadeStart,
                    yearTo:
                      decadeStart !== undefined ? decadeStart + 9 : undefined,
                  })
                }
              />
              <StarRatingPicker
                value={filter.minRating}
                onChange={(v) => update({ minRating: v })}
              />
              <Dropdown
                accent
                value={`${filter.sortBy}-${filter.sortDirection}`}
                onChange={handleSortChange}
                options={SORT_OPTIONS.map((o) => ({
                  label: t(o.labelKey),
                  value: `${o.sortBy}-${o.sortDirection}`,
                }))}
              />
            </div>
          )}

          {tab === "movies" && activeChips.length > 0 && (
            <div className="spotlight-card__chips">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  className="filter-chip"
                  onClick={chip.onRemove}
                >
                  {chip.label} <X size={12} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === "movies" && (
        <>
          {data && !isLoading && (
            <p className="search-page__results-count">
              {t("search.resultsCount", { count: data.totalCount })}
            </p>
          )}

          {isLoading && <MovieGridSkeleton count={12} />}

          {isError && !isLoading && (
            <PageError
              message={t("errors.searchFailed")}
              onRetry={() => refetch()}
            />
          )}

          {data &&
            !isLoading &&
            (data.items.length > 0 ? (
              <>
                <div className="movie-grid">
                  {data.items.map((m) => (
                    <MovieCard key={m.id} movie={m} />
                  ))}
                </div>
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  onChange={goToPage}
                />
              </>
            ) : (
              <EmptyState
                icon={<SearchIcon size={26} />}
                title={t("search.noResults")}
                hint={t("search.changeFilters")}
              />
            ))}
        </>
      )}

      {tab === "actors" && (
        <PersonResults
          isLoading={isActorLoading}
          query={actorQuery}
          results={actorResults}
          entityRoute="/actors"
          onPageChange={setActorPage}
        />
      )}

      {tab === "directors" && (
        <PersonResults
          isLoading={isDirectorLoading}
          query={directorQuery}
          results={directorResults}
          entityRoute="/directors"
          onPageChange={setDirectorPage}
        />
      )}
    </div>
  );
}

// Oyuncu ve yönetmen sonuçları için ortak grid — ikisi de aynı şekle sahip (id, fullName, photoUrl, nationality)
function PersonResults({
  isLoading,
  query,
  results,
  entityRoute,
  onPageChange,
}: {
  isLoading: boolean;
  query: string;
  results?: PagedResult<ActorListItem | DirectorListItem>;
  entityRoute: string;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();

  if (isLoading && query.trim().length > 0)
    return <MovieGridSkeleton count={8} />;

  if (results && results.items.length > 0) {
    return (
      <>
        <div className="person-grid">
          {results.items.map((p) => (
            <Link
              key={p.id}
              to={`${entityRoute}/${p.id}`}
              className="person-grid__item card"
            >
              <img src={p.photoUrl} alt={p.fullName} />
              <span>{p.fullName}</span>
              {p.nationality && (
                <span className="person-grid__nationality">
                  {p.nationality}
                </span>
              )}
            </Link>
          ))}
        </div>
        <Pagination
          page={results.page}
          totalPages={results.totalPages}
          onChange={(p) => {
            onPageChange(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </>
    );
  }

  return query.trim().length > 0 && !isLoading ? (
    <EmptyState icon={<Users size={26} />} title={t("search.noResults")} />
  ) : (
    <EmptyState icon={<Users size={26} />} title={t("search.startTyping")} />
  );
}
