import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, Plus, Search } from "lucide-react";
import { directorService, profileService } from "@/services";
import type { FavoriteDirectorSlot } from "@/types";
import "./FavoriteSlotPicker.css";

interface Props {
  slots: FavoriteDirectorSlot[];
}

export default function FavoriteDirectorSlotPicker({ slots }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const { data: results } = useQuery({
    queryKey: ["favorite-director-slot-search", query],
    queryFn: () => directorService.search(query, 1, 8),
    enabled: editingSlot !== null && query.trim().length > 0,
  });

  const setMutation = useMutation({
    mutationFn: ({ slot, directorId }: { slot: number; directorId: string }) =>
      profileService.setFavoriteDirectorSlot(slot, directorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setEditingSlot(null);
      setQuery("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (slot: number) =>
      profileService.removeFavoriteDirectorSlot(slot),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  return (
    <div className="favorite-slots">
      {slots.map(({ slot, director }) => (
        <div key={slot} className="favorite-slot">
          {editingSlot === slot ? (
            <div className="favorite-slot__editor card">
              <div className="favorite-slot__search-row">
                <Search size={14} />
                <input
                  autoFocus
                  placeholder={t("profile.searchDirectorPlaceholder")}
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
                    results.items.map((d) => (
                      <button
                        key={d.id}
                        className="favorite-slot__result"
                        onClick={() =>
                          setMutation.mutate({ slot, directorId: d.id })
                        }
                        disabled={setMutation.isPending}
                      >
                        <img src={d.photoUrl} alt="" />
                        <span>{d.fullName}</span>
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
          ) : director ? (
            <div className="favorite-slot__filled">
              <span className="favorite-slot__number">
                {String(slot).padStart(2, "0")}
              </span>
              <img src={director.photoUrl} alt={director.fullName} />
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
              <p className="favorite-slot__title">{director.fullName}</p>
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
              <span>{t("profile.chooseDirector")}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
