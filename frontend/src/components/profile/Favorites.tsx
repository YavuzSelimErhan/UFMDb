// Favorites.tsx
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Clapperboard, Film, Users, X, Plus, Search } from "lucide-react";
import {
  actorService,
  directorService,
  movieService,
  profileService,
} from "@/services";
import type {
  FavoriteSlot,
  FavoriteActorSlot,
  FavoriteDirectorSlot,
} from "@/types";
import "./Favorites.css";

/* ---------- ortak tipler ---------- */

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
}

interface SlotItem extends SearchResult {
  href: string;
}

interface SlotData {
  slot: number;
  item?: SlotItem;
}

interface SlotConfig {
  queryKeyPrefix: string;
  searchPlaceholder: string;
  emptyActionLabel: string;
  emptyOtherLabel: string;
  search: (query: string) => Promise<SearchResult[]>;
  setSlot: (slot: number, itemId: string) => Promise<unknown>;
  removeSlot: (slot: number) => Promise<unknown>;
}

/* ---------- alt-component: tek bir sekmenin slot grid'i ---------- */
/* Dışarı export edilmiyor, sadece Favorites içinde kullanılıyor. */

function SlotPicker({
  slots,
  isOwnProfile,
  config,
}: {
  slots: SlotData[];
  isOwnProfile: boolean;
  config: SlotConfig;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => clearTimeout(id);
  }, [query]);

  const { data: results } = useQuery({
    queryKey: [config.queryKeyPrefix, "search", debouncedQuery],
    queryFn: () => config.search(debouncedQuery),
    enabled: editingSlot !== null && debouncedQuery.length > 0,
  });

  const setMutation = useMutation({
    mutationFn: ({ slot, itemId }: { slot: number; itemId: string }) =>
      config.setSlot(slot, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setEditingSlot(null);
      setQuery("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (slot: number) => config.removeSlot(slot),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  return (
    <div className="favorite-slots">
      {slots.map(({ slot, item }) => (
        <div key={slot} className="favorite-slot">
          {isOwnProfile && editingSlot === slot ? (
            <div className="favorite-slot__editor card">
              <div className="favorite-slot__search-row">
                <Search size={14} />
                <input
                  autoFocus
                  placeholder={config.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  onClick={() => {
                    setEditingSlot(null);
                    setQuery("");
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              {query.trim().length > 0 && (
                <div className="favorite-slot__results">
                  {results?.length ? (
                    results.map((r) => (
                      <button
                        key={r.id}
                        className="favorite-slot__result"
                        onClick={() =>
                          setMutation.mutate({ slot, itemId: r.id })
                        }
                        disabled={setMutation.isPending}
                      >
                        <img src={r.imageUrl} alt="" />
                        <span>
                          {r.title}
                          {r.subtitle && (
                            <span className="text-muted"> ({r.subtitle})</span>
                          )}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-muted favorite-slot__no-results">
                      {t("search.noResults")}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : item ? (
            <Link to={item.href} className="favorite-slot__filled">
              <span className="favorite-slot__number">
                {String(slot).padStart(2, "0")}
              </span>
              <img src={item.imageUrl} alt={item.title} />
              {isOwnProfile && (
                <div className="favorite-slot__overlay">
                  <button
                    className="favorite-slot__change-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingSlot(slot);
                    }}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    className="favorite-slot__remove-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeMutation.mutate(slot);
                    }}
                  >
                    <X size={13} /> {t("profile.removeFavorite")}
                  </button>
                </div>
              )}
              <p className="favorite-slot__title">{item.title}</p>
            </Link>
          ) : isOwnProfile ? (
            <button
              className="favorite-slot__empty"
              onClick={() => setEditingSlot(slot)}
            >
              <span className="favorite-slot__number">
                {String(slot).padStart(2, "0")}
              </span>
              <Plus size={22} />
              <span>{t(config.emptyActionLabel)}</span>
            </button>
          ) : (
            <div className="favorite-slot__empty favorite-slot__empty--static">
              <span className="favorite-slot__number">
                {String(slot).padStart(2, "0")}
              </span>
              <span className="favorite-slot__empty-text">
                {t(config.emptyOtherLabel)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- tema ---------- */

type FavTab = "movies" | "actors" | "directors";

const THEME: Record<
  FavTab,
  { accent: string; dim: string; glow: string; icon: typeof Film }
> = {
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

/* ---------- dışa açık tek component ---------- */

interface Props {
  movies: FavoriteSlot[];
  actors: FavoriteActorSlot[];
  directors: FavoriteDirectorSlot[];
  isOwnProfile: boolean;
}

export default function Favorites({
  movies,
  actors,
  directors,
  isOwnProfile,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FavTab>("movies");
  const theme = THEME[tab];

  const movieSlots: SlotData[] = useMemo(
    () =>
      movies.map(({ slot, movie }) => ({
        slot,
        item: movie
          ? {
              id: movie.id,
              title: movie.title,
              subtitle: String(movie.releaseYear),
              imageUrl: movie.posterUrl,
              href: `/movies/${movie.id}`,
            }
          : undefined,
      })),
    [movies],
  );

  const actorSlots: SlotData[] = useMemo(
    () =>
      actors.map(({ slot, actor }) => ({
        slot,
        item: actor
          ? {
              id: actor.id,
              title: actor.fullName,
              imageUrl: actor.photoUrl,
              href: `/actors/${actor.id}`,
            }
          : undefined,
      })),
    [actors],
  );

  const directorSlots: SlotData[] = useMemo(
    () =>
      directors.map(({ slot, director }) => ({
        slot,
        item: director
          ? {
              id: director.id,
              title: director.fullName,
              imageUrl: director.photoUrl,
              href: `/directors/${director.id}`,
            }
          : undefined,
      })),
    [directors],
  );

  const configs: Record<FavTab, SlotConfig> = {
    movies: {
      queryKeyPrefix: "favorite-movie-slot",
      searchPlaceholder: t("profile.searchPlaceholder"),
      emptyActionLabel: "profile.chooseMovie",
      emptyOtherLabel: "profile.noFavoriteYet",
      search: async (query) => {
        const res = await movieService.search({
          title: query,
          page: 1,
          pageSize: 8,
          sortBy: "rating",
        });
        return res.items.map((m) => ({
          id: m.id,
          title: m.title,
          subtitle: String(m.releaseYear),
          imageUrl: m.posterUrl,
        }));
      },
      setSlot: (slot, itemId) => profileService.setFavoriteSlot(slot, itemId),
      removeSlot: (slot) => profileService.removeFavoriteSlot(slot),
    },
    actors: {
      queryKeyPrefix: "favorite-actor-slot",
      searchPlaceholder: t("profile.searchActorPlaceholder"),
      emptyActionLabel: "profile.chooseActor",
      emptyOtherLabel: "profile.noFavoriteYet",
      search: async (query) => {
        const res = await actorService.search(query, 1, 8);
        return res.items.map((a) => ({
          id: a.id,
          title: a.fullName,
          imageUrl: a.photoUrl,
        }));
      },
      setSlot: (slot, itemId) =>
        profileService.setFavoriteActorSlot(slot, itemId),
      removeSlot: (slot) => profileService.removeFavoriteActorSlot(slot),
    },
    directors: {
      queryKeyPrefix: "favorite-director-slot",
      searchPlaceholder: t("profile.searchDirectorPlaceholder"),
      emptyActionLabel: "profile.chooseDirector",
      emptyOtherLabel: "profile.noFavoriteYet",
      search: async (query) => {
        const res = await directorService.search(query, 1, 8);
        return res.items.map((d) => ({
          id: d.id,
          title: d.fullName,
          imageUrl: d.photoUrl,
        }));
      },
      setSlot: (slot, itemId) =>
        profileService.setFavoriteDirectorSlot(slot, itemId),
      removeSlot: (slot) => profileService.removeFavoriteDirectorSlot(slot),
    },
  };

  const slotsByTab: Record<FavTab, SlotData[]> = {
    movies: movieSlots,
    actors: actorSlots,
    directors: directorSlots,
  };

  return (
    <section
      className="fav-showcase"
      style={
        {
          "--fav-accent": theme.accent,
          "--fav-accent-dim": theme.dim,
          "--fav-glow": theme.glow,
        } as React.CSSProperties
      }
    >
      <div className="fav-showcase__header">
        <div className="fav-showcase__label-wrap">
          <p className="fav-showcase__eyebrow">
            {t(
              isOwnProfile
                ? "profile.showcaseEyebrow"
                : "profile.showcaseEyebrowOther",
            )}
          </p>
          <h2 className="fav-showcase__title">
            {t(
              isOwnProfile
                ? "profile.showcaseTitle"
                : "profile.showcaseTitleOther",
            )}
          </h2>
        </div>

        <div className="fav-showcase__tabs">
          {(["movies", "actors", "directors"] as FavTab[]).map((key) => {
            const Icon = THEME[key].icon;
            return (
              <button
                key={key}
                className={`fav-showcase__tab ${tab === key ? "is-active" : ""}`}
                style={
                  tab === key
                    ? {
                        background: `linear-gradient(135deg, ${THEME[key].accent}, ${THEME[key].accent}cc)`,
                      }
                    : undefined
                }
                onClick={() => setTab(key)}
              >
                <Icon size={14} />{" "}
                {t(
                  `profile.favorite${key.charAt(0).toUpperCase() + key.slice(1)}Tab`,
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fav-showcase__panel">
        <SlotPicker
          slots={slotsByTab[tab]}
          isOwnProfile={isOwnProfile}
          config={configs[tab]}
        />
      </div>
    </section>
  );
}
