import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import type { MovieListItem } from "@/types";
// VARSAYIM: movieService.search(filter: MovieSearchFilter) => PagedResult<MovieListItem>.
// Projedeki gerçek film arama fonksiyonunun adı/imzası farklıysa SADECE aşağıdaki
// queryFn satırını düzelt.
import { movieService } from "@/services";
import { getImageUrl } from "@/utils/getImageUrl";
import "./CoverPickerModal.css";

interface Props {
  favorites: MovieListItem[];
  /** Şu an seçili kapak filmi; null = varsayılan (ilk favori) */
  selectedId: string | null;
  isSaving: boolean;
  isError: boolean;
  /** null => varsayılana dön */
  onSelect: (movieId: string | null) => void;
  onClose: () => void;
}

export default function CoverPickerModal({
  favorites,
  selectedId,
  isSaving,
  isError,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term.trim()), 300);
    return () => window.clearTimeout(id);
  }, [term]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { data, isFetching } = useQuery({
    queryKey: ["cover-picker-search", debounced],
    queryFn: () => movieService.search({ title: debounced, pageSize: 12 }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  // Backdrop'u olmayan filmler kapak olamaz (backend de reddeder).
  const favs = favorites.filter((m) => m.backdropUrl);
  const results = (data?.items ?? []).filter((m) => m.backdropUrl);

  const tile = (m: MovieListItem) => (
    <button
      key={m.id}
      type="button"
      className={`cover-picker__tile${selectedId === m.id ? " is-selected" : ""}`}
      disabled={isSaving}
      onClick={() => onSelect(m.id)}
    >
      <img src={getImageUrl(m.backdropUrl)} alt="" loading="lazy" />
      <span className="cover-picker__tile-title">{m.title}</span>
      {selectedId === m.id && (
        <span className="cover-picker__tile-check" aria-hidden="true">
          <Check size={14} />
        </span>
      )}
    </button>
  );

  return (
    <div
      className="cover-picker"
      role="dialog"
      aria-modal="true"
      aria-label={t("profile.coverPickerTitle", {
        defaultValue: "Bir film kapağı seç",
      })}
      onClick={onClose}
    >
      <div className="cover-picker__panel" onClick={(e) => e.stopPropagation()}>
        <div className="cover-picker__head">
          <h2>
            {t("profile.coverPickerTitle", {
              defaultValue: "Bir film kapağı seç",
            })}
          </h2>
          <button
            type="button"
            className="cover-picker__close"
            onClick={onClose}
            aria-label={t("common.cancel")}
          >
            <X size={18} />
          </button>
        </div>

        {favs.length > 0 && (
          <section className="cover-picker__section">
            <h3>
              {t("profile.coverFromFavorites", {
                defaultValue: "Favori filmlerin",
              })}
            </h3>
            <div className="cover-picker__grid">{favs.map(tile)}</div>
          </section>
        )}

        <section className="cover-picker__section">
          <h3>
            {t("profile.coverSearch", { defaultValue: "Başka film ara" })}
          </h3>
          <label className="cover-picker__search">
            <Search size={15} aria-hidden="true" />
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t("profile.coverSearchPlaceholder", {
                defaultValue: "Film adı yaz",
              })}
              autoFocus
            />
          </label>

          {debounced.length >= 2 && (
            <>
              {results.length > 0 ? (
                <div className="cover-picker__grid">{results.map(tile)}</div>
              ) : (
                !isFetching && (
                  <p className="cover-picker__hint">
                    {t("profile.coverNoResults", {
                      defaultValue: "Kapak görseli olan film bulunamadı.",
                    })}
                  </p>
                )
              )}
            </>
          )}
        </section>

        {isError && (
          <p className="cover-picker__error" role="alert">
            {t("profile.coverSaveFailed", {
              defaultValue: "Kapak kaydedilemedi. Tekrar dene.",
            })}
          </p>
        )}

        {selectedId && (
          <div className="cover-picker__footer">
            <button
              type="button"
              className="btn-secondary"
              disabled={isSaving}
              onClick={() => onSelect(null)}
            >
              {t("profile.coverReset", {
                defaultValue: "Varsayılana dön (ilk favori film)",
              })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
