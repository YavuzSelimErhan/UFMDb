import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, Plus, Search } from "lucide-react";
import { actorService, profileService } from "@/services";
import type { FavoriteActorSlot } from "@/types";
import "./FavoriteSlotPicker.css";

interface Props {
  slots: FavoriteActorSlot[];
  isOwnProfile: boolean;
}

export default function FavoriteActorSlotPicker({
  slots,
  isOwnProfile,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const { data: results } = useQuery({
    queryKey: ["favorite-actor-slot-search", query],
    queryFn: () => actorService.search(query, 1, 8),
    enabled: editingSlot !== null && query.trim().length > 0,
  });

  const setMutation = useMutation({
    mutationFn: ({ slot, actorId }: { slot: number; actorId: string }) =>
      profileService.setFavoriteActorSlot(slot, actorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setEditingSlot(null);
      setQuery("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (slot: number) => profileService.removeFavoriteActorSlot(slot),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  return (
    <div className="favorite-slots">
      {slots
        .filter((s) => isOwnProfile || s.actor)
        .map(({ slot, actor }) => (
          <div key={slot} className="favorite-slot">
            {isOwnProfile && editingSlot === slot ? (
              <div className="favorite-slot__editor card">
                <div className="favorite-slot__search-row">
                  <Search size={14} />
                  <input
                    autoFocus
                    placeholder={t("profile.searchActorPlaceholder")}
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
                      results.items.map((a) => (
                        <button
                          key={a.id}
                          className="favorite-slot__result"
                          onClick={() =>
                            setMutation.mutate({ slot, actorId: a.id })
                          }
                          disabled={setMutation.isPending}
                        >
                          <img src={a.photoUrl} alt="" />
                          <span>{a.fullName}</span>
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
            ) : actor ? (
              <div className="favorite-slot__filled">
                <span className="favorite-slot__number">
                  {String(slot).padStart(2, "0")}
                </span>
                <img src={actor.photoUrl} alt={actor.fullName} />
                {isOwnProfile && (
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
                )}
                <p className="favorite-slot__title">{actor.fullName}</p>
              </div>
            ) : isOwnProfile ? (
              <button
                className="favorite-slot__empty"
                onClick={() => setEditingSlot(slot)}
              >
                <span className="favorite-slot__number">
                  {String(slot).padStart(2, "0")}
                </span>
                <Plus size={22} />
                <span>{t("profile.chooseActor")}</span>
              </button>
            ) : null}
          </div>
        ))}
    </div>
  );
}
