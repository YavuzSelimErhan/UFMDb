import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search, X } from "lucide-react";
import { movieService } from "@/services";
import type { MovieListItem } from "@/types";

const MIN_CHARS = 2;
const MAX_RESULTS = 8;

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

interface Props {
  /** Şu an watchlist'te olan film id'leri. */
  watchlistIds: Set<string>;
}

export default function WatchlistAddSearch({ watchlistIds }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  // Profil yeniden yüklenene kadar, az önce eklenenleri de "Listede" göster.
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  const debounced = useDebounced(term.trim(), 300);
  const enabled = debounced.length >= MIN_CHARS;

  // VARSAYIM: movieService.search(filter) -> PagedResult<MovieListItem>
  const { data, isFetching, isError } = useQuery({
    queryKey: ["watchlist-add-search", debounced],
    queryFn: () =>
      movieService.search({ title: debounced, pageSize: MAX_RESULTS }),
    enabled,
    staleTime: 60_000,
  });
  const results: MovieListItem[] = data?.items ?? [];

  // VARSAYIM: movieService.toggleWatchlist(movieId)
  const addMutation = useMutation({
    mutationFn: (movieId: string) => movieService.toggleWatchlist(movieId),
    onMutate: (movieId) => setPendingId(movieId),
    onSuccess: (_res, movieId) => {
      setJustAdded((prev) => new Set(prev).add(movieId));
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onSettled: () => setPendingId(null),
  });

  return (
    <div className="wl-add">
      <label className="wl-add__field">
        <Search size={15} />
        <input
          type="text"
          value={term}
          placeholder={t("watchlist.add.placeholder")}
          aria-label={t("watchlist.add.placeholder")}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setTerm("");
          }}
        />
        {term && (
          <button
            type="button"
            className="wl-add__clear"
            aria-label={t("common.close")}
            onClick={() => setTerm("")}
          >
            <X size={14} />
          </button>
        )}
      </label>

      {enabled && (
        <div className="wl-add__results card">
          {isFetching && results.length === 0 ? (
            <p className="wl-add__hint">{t("common.loading")}</p>
          ) : isError ? (
            <p className="wl-add__hint">{t("watchlist.add.failed")}</p>
          ) : results.length === 0 ? (
            <p className="wl-add__hint">{t("watchlist.add.noResults")}</p>
          ) : (
            results.slice(0, MAX_RESULTS).map((m) => {
              const inList =
                watchlistIds.has(m.id) ||
                justAdded.has(m.id) ||
                m.isInWatchlistByCurrentUser;
              const isThisPending = pendingId === m.id;

              return (
                <div key={m.id} className="wl-add__item">
                  <img
                    src={m.posterUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="wl-add__meta">
                    <span className="wl-add__title">{m.title}</span>
                    {m.releaseYear > 0 && (
                      <span className="wl-add__year">{m.releaseYear}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="wl-add__btn"
                    disabled={inList || addMutation.isPending}
                    onClick={() => addMutation.mutate(m.id)}
                  >
                    {inList ? <Check size={14} /> : <Plus size={14} />}
                    {inList
                      ? t("watchlist.add.inList")
                      : isThisPending
                        ? t("common.loading")
                        : t("watchlist.add.add")}
                  </button>
                </div>
              );
            })
          )}

          {addMutation.isError && (
            <p className="wl-add__hint wl-add__hint--error" role="alert">
              {t("watchlist.add.failed")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
