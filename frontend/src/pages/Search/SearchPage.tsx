import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Search as SearchIcon,
  Film,
  Users,
  Filter,
  ArrowUpDown,
  X,
} from "lucide-react";
import {
  movieService,
  genreService,
  personService,
  countryService,
} from "@/services";
import { useAppSelector } from "@/store";
import RandomPicker from "@/components/random/RandomPicker";
import MovieCard from "@/components/movie/MovieCard";
import PersonCard from "@/components/person/PersonCard";
import { useScreeningLogModal } from "@/hooks/useScreeningLogModal";
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
  PersonRole,
  PersonSearchItem,
  PersonSort,
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

const PEOPLE_ROLES: PersonRole[] = [
  "actor",
  "director",
  "writer",
  "composer",
  "cinematographer",
  "editor",
  "producer",
];
const PEOPLE_SORTS: PersonSort[] = ["popular", "likes", "name"];
const PEOPLE_PAGE_SIZE = 24;

const isPersonRole = (v: string | null): v is PersonRole =>
  v !== null && (PEOPLE_ROLES as string[]).includes(v);
const isPersonSort = (v: string | null): v is PersonSort =>
  v !== null && (PEOPLE_SORTS as string[]).includes(v);

type Tab = "movies" | "people";

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
  people: {
    accent: "#4a90e2",
    dim: "rgba(74,144,226,0.14)",
    glow: "rgba(74,144,226,0.30)",
    icon: Users,
  },
};

const TABS: { key: Tab; labelKey: string }[] = [
  { key: "movies", labelKey: "search.moviesTab" },
  { key: "people", labelKey: "search.peopleTab" },
];

function filterFromParams(params: URLSearchParams): MovieSearchFilter {
  return {
    page: Number(params.get("page")) || 1,
    pageSize: 25,
    sortBy:
      (params.get("sortBy") as MovieSearchFilter["sortBy"]) ?? "popularity",
    sortDirection: (params.get("sortDirection") as "asc" | "desc") ?? "desc",
    genre: params.get("genre") ?? undefined,
    title: params.get("title") ?? undefined,
    country: params.get("country") ?? undefined,
    year: params.get("year") ? Number(params.get("year")) : undefined,
    yearFrom: params.get("yearFrom")
      ? Number(params.get("yearFrom"))
      : undefined,
    yearTo: params.get("yearTo") ? Number(params.get("yearTo")) : undefined,
    minRating: params.get("minRating")
      ? Number(params.get("minRating"))
      : undefined,
    releaseDateFrom: params.get("releaseDateFrom") ?? undefined,
    releaseDateTo: params.get("releaseDateTo") ?? undefined,
  };
}

function writeFilterParams(n: URLSearchParams, filter: MovieSearchFilter) {
  const set = (
    key: string,
    value: string | number | undefined,
    skip?: string | number,
  ) => {
    if (value == null || value === skip) n.delete(key);
    else n.set(key, String(value));
  };
  set("page", filter.page, 1);
  set("sortBy", filter.sortBy, "popularity");
  set("sortDirection", filter.sortDirection, "desc");
  set("genre", filter.genre);
  set("title", filter.title);
  set("country", filter.country);
  set("year", filter.year);
  set("yearFrom", filter.yearFrom);
  set("yearTo", filter.yearTo);
  set("minRating", filter.minRating);
  set("releaseDateFrom", filter.releaseDateFrom);
  set("releaseDateTo", filter.releaseDateTo);
}

export default function SearchPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openLog, logModal } = useScreeningLogModal();
  const { isAuthenticated } = useAppSelector((s) => s.auth);

  // Eski linkler (?tab=actors / ?tab=directors) "Kişiler" sekmesine, ilgili rol seçili olarak açılır.
  const rawTab = searchParams.get("tab");
  const tab: Tab =
    rawTab === "people" || rawTab === "actors" || rawTab === "directors"
      ? "people"
      : "movies";
  const theme = THEME[tab];

  // ---- Film state (URL'den) ----
  const filter = filterFromParams(searchParams);

  // Rastgele seçici havuzu: aktif filtrelere uyan filmlerden sunucu örneklemi.
  const fetchRandomPool = async () => {
    const res = await movieService.search({
      ...filter,
      sortBy: "random",
      sortDirection: "desc",
      page: 1,
      pageSize: 40,
    });
    return res.items;
  };

  // ---- Kişi state (URL'den) ----
  const legacyRole: PersonRole | "" =
    rawTab === "actors" ? "actor" : rawTab === "directors" ? "director" : "";
  const roleParam = searchParams.get("role");
  const peopleRole: PersonRole | "" = isPersonRole(roleParam)
    ? roleParam
    : legacyRole;
  const sortParam = searchParams.get("sort");
  const peopleSort: PersonSort = isPersonSort(sortParam)
    ? sortParam
    : "popular";
  const peopleQuery = tab === "people" ? (searchParams.get("q") ?? "") : "";
  const peoplePage =
    tab === "people" ? Number(searchParams.get("page")) || 1 : 1;

  const { data: genres } = useQuery({
    queryKey: ["genres"],
    queryFn: genreService.getAll,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: countryService.getAll,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["movie-search", filter],
    queryFn: () => movieService.search(filter),
    enabled: tab === "movies",
    retry: 1,
  });

  // Tüm roller tek kaynaktan (People) gelir; rol ve sıralama sunucuda uygulanır.
  const {
    data: peopleResults,
    isLoading: isPeopleLoading,
    isError: isPeopleError,
    refetch: refetchPeople,
  } = useQuery({
    queryKey: [
      "people-search",
      peopleRole,
      peopleSort,
      peopleQuery,
      peoplePage,
      isAuthenticated,
    ],
    queryFn: () =>
      personService.search({
        search: peopleQuery.trim() || undefined,
        role: peopleRole || undefined,
        sort: peopleSort,
        page: peoplePage,
        pageSize: PEOPLE_PAGE_SIZE,
      }),
    enabled: tab === "people",
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const setTab = (next: Tab) => {
    // Tab değişince o tab'a ait temiz bir arama başlat (diğerinin filtrelerini taşımıyoruz)
    const n = new URLSearchParams();
    if (next !== "movies") n.set("tab", next);
    setSearchParams(n);
  };

  const update = (patch: Partial<MovieSearchFilter>) => {
    const next = { ...filter, ...patch, page: 1 };
    const n = new URLSearchParams(searchParams);
    writeFilterParams(n, next);
    setSearchParams(n);
  };

  const goToPage = (page: number) => {
    const n = new URLSearchParams(searchParams);
    writeFilterParams(n, { ...filter, page });
    setSearchParams(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSortChange = (value: string) => {
    const opt = SORT_OPTIONS.find(
      (o) => `${o.sortBy}-${o.sortDirection}` === value,
    );
    if (opt) update({ sortBy: opt.sortBy, sortDirection: opt.sortDirection });
  };

  // Rol / sıralama değişince URL'yi yeni biçime (tab=people&role=...) çevirir ve ilk sayfaya döner.
  const updatePeople = (patch: {
    role?: PersonRole | "";
    sort?: PersonSort;
  }) => {
    const role = patch.role ?? peopleRole;
    const sort = patch.sort ?? peopleSort;
    const n = new URLSearchParams(searchParams);
    n.set("tab", "people");
    if (role) n.set("role", role);
    else n.delete("role");
    if (sort !== "popular") n.set("sort", sort);
    else n.delete("sort");
    n.delete("page");
    setSearchParams(n);
  };

  const setPeoplePage = (page: number) => {
    const n = new URLSearchParams(searchParams);
    if (page > 1) n.set("page", String(page));
    else n.delete("page");
    setSearchParams(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const genreLabel = (name?: string) => {
    if (!name) return "";
    const match = genres?.find((g) => g.name === name || g.nameTr === name);
    return match ? (i18n.language === "tr" ? match.nameTr : match.name) : name;
  };

  const countryLabel = (name?: string) => {
    if (!name) return "";
    const match = countries?.find((c) => c.name === name || c.nameTr === name);
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
    filter.country && {
      key: "country",
      label: countryLabel(filter.country),
      onRemove: () => update({ country: undefined }),
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
  const currentQuery = tab === "movies" ? (filter.title ?? "") : peopleQuery;
  const currentPlaceholder =
    tab === "movies"
      ? t("search.titlePlaceholder")
      : t("search.peopleSearchPlaceholder");

  const handleQueryChange = (value: string) => {
    if (tab === "movies") {
      update({ title: value || undefined });
      return;
    }
    const n = new URLSearchParams(searchParams);
    n.set("tab", "people");
    if (peopleRole) n.set("role", peopleRole);
    if (value) n.set("q", value);
    else n.delete("q");
    n.delete("page");
    setSearchParams(n);
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
              <Dropdown
                value={filter.country ?? ""}
                onChange={(v) => update({ country: v || undefined })}
                options={[
                  { label: t("search.allCountries"), value: "" },
                  ...(countries?.map((c) => ({
                    label: i18n.language === "tr" ? c.nameTr : c.name,
                    value: i18n.language === "tr" ? c.nameTr : c.name,
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

              <RandomPicker
                className="search-page__random"
                source={fetchRandomPool}
                disabled={!data || data.totalCount === 0}
              />
            </div>
          )}

          {tab === "people" && (
            <div className="spotlight-card__filters">
              <Dropdown
                icon={<Filter size={14} />}
                value={peopleRole}
                onChange={(v) => updatePeople({ role: v as PersonRole | "" })}
                options={[
                  { label: t("personFilmography.all"), value: "" },
                  ...PEOPLE_ROLES.map((r) => ({
                    label: t(`people.roles.${r}`),
                    value: r,
                  })),
                ]}
              />
              <Dropdown
                accent
                icon={<ArrowUpDown size={14} />}
                value={peopleSort}
                onChange={(v) => updatePeople({ sort: v as PersonSort })}
                options={PEOPLE_SORTS.map((s) => ({
                  label: t(`search.peopleSort.${s}`),
                  value: s,
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
                    <MovieCard
                      key={m.id}
                      movie={m}
                      onLogClick={() => openLog(m)}
                    />
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

      {tab === "people" && (
        <PeopleResults
          isLoading={isPeopleLoading}
          isError={isPeopleError}
          results={peopleResults}
          onRetry={() => refetchPeople()}
          onPageChange={setPeoplePage}
        />
      )}

      {logModal}
    </div>
  );
}

function PeopleResults({
  isLoading,
  isError,
  results,
  onRetry,
  onPageChange,
}: {
  isLoading: boolean;
  isError: boolean;
  results?: PagedResult<PersonSearchItem>;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();

  if (isLoading) return <MovieGridSkeleton count={12} />;

  if (isError && !results)
    return <PageError message={t("errors.searchFailed")} onRetry={onRetry} />;

  if (!results || results.items.length === 0)
    return (
      <EmptyState
        icon={<Users size={26} />}
        title={t("search.noResults")}
        hint={t("search.changeFilters")}
      />
    );

  return (
    <>
      <p className="search-page__results-count">
        {t("search.resultsCount", { count: results.totalCount })}
      </p>
      <div className="people-grid">
        {results.items.map((p) => (
          <PersonCard key={p.id} person={p} />
        ))}
      </div>
      <Pagination
        page={results.page}
        totalPages={results.totalPages}
        onChange={onPageChange}
      />
    </>
  );
}
