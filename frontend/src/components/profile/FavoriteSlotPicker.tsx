import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, Plus, Search } from "lucide-react";
import { movieService, profileService } from "@/services";
import type { FavoriteSlot } from "@/types";
import "./FavoriteSlotPicker.css";

interface Props {
  slots: FavoriteSlot[];
}

export default function FavoriteSlotPicker({ slots }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const { data: results } = useQuery({
    queryKey: ["favorite-slot-search", query],
    queryFn: () =>
      movieService.search({
        title: query,
        page: 1,
        pageSize: 8,
        sortBy: "rating",
      }),
    enabled: editingSlot !== null && query.trim().length > 0,
  });

  const setMutation = useMutation({
    mutationFn: ({ slot, movieId }: { slot: number; movieId: string }) =>
      profileService.setFavoriteSlot(slot, movieId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setEditingSlot(null);
      setQuery("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (slot: number) => profileService.removeFavoriteSlot(slot),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  return (
    <div className="favorite-slots">
      {slots.map(({ slot, movie }) => (
        <div key={slot} className="favorite-slot">
          {editingSlot === slot ? (
            <div className="favorite-slot__editor card">
              <div className="favorite-slot__search-row">
                <Search size={14} />
                <input
                  autoFocus
                  placeholder={t("profile.searchPlaceholder")}
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
                  {results?.items.length ? (
                    results.items.map((m) => (
                      <button
                        key={m.id}
                        className="favorite-slot__result"
                        onClick={() =>
                          setMutation.mutate({ slot, movieId: m.id })
                        }
                        disabled={setMutation.isPending}
                      >
                        <img src={m.posterUrl} alt="" />
                        <span>
                          {m.title}{" "}
                          <span className="text-muted">({m.releaseYear})</span>
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
          ) : movie ? (
            <div className="favorite-slot__filled">
              <span className="favorite-slot__number">
                {String(slot).padStart(2, "0")}
              </span>
              <img src={movie.posterUrl} alt={movie.title} />
              <div className="favorite-slot__overlay">
                <button
                  className="favorite-slot__change-btn"
                  onClick={() => setEditingSlot(slot)}
                >
                  {t("common.edit")}
                </button>
                <button
                  className="favorite-slot__remove-btn"
                  onClick={() => removeMutation.mutate(slot)}
                >
                  <X size={13} /> {t("profile.removeFavorite")}
                </button>
              </div>
              <p className="favorite-slot__title">{movie.title}</p>
            </div>
          ) : (
            <button
              className="favorite-slot__empty"
              onClick={() => setEditingSlot(slot)}
            >
              <span className="favorite-slot__number">
                {String(slot).padStart(2, "0")}
              </span>
              <Plus size={22} />
              <span>{t("profile.chooseMovie")}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
