import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Star, Trash2, X } from "lucide-react";
import { profileService, movieService } from "@/services";
import Dropdown from "@/components/search/Dropdown";
import Pagination from "@/components/common/Pagination";
import { EmptyState } from "@/components/common/PageState";
import type { WatchedMovie } from "@/types";
import "./ProfileFilmsTab.css";

const SORT_OPTIONS = [
  { label: "watchedDesc", value: "watched-desc" },
  { label: "watchedAsc", value: "watched-asc" },
  { label: "releaseDesc", value: "release-desc" },
  { label: "releaseAsc", value: "release-asc" },
  { label: "myRatingDesc", value: "rating-desc" },
  { label: "myRatingAsc", value: "rating-asc" },
  { label: "filmRatingDesc", value: "movie-rating-desc" },
  { label: "filmRatingAsc", value: "movie-rating-asc" },
  { label: "titleAsc", value: "title-asc" },
];

function monthLabel(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function yearLabel(dateStr: string | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).getFullYear().toString();
}

function groupEntries(items: WatchedMovie[], sortBy: string, locale: string) {
  const isWatchedSort = sortBy === "watched-desc" || sortBy === "watched-asc";
  const isReleaseSort = sortBy === "release-desc" || sortBy === "release-asc";
  if (!isWatchedSort && !isReleaseSort) return null;

  const groups: { label: string; items: WatchedMovie[] }[] = [];
  for (const item of items) {
    const label = isWatchedSort
      ? monthLabel(item.watchedAtUtc, locale)
      : yearLabel(item.movie.releaseDate);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

type PanelMode = "none" | "rate" | "delete";

// Letterboxd tarzı yarım-yıldız destekli, tıklanabilir puanlama input'u.
// Her yıldız görsel olarak ikiye bölünmüş görünmez hit-area'lara sahip:
// sol yarıya tıklamak x.5, sağ yarıya tıklamak x.0 değerini verir.
function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div
      className="star-input"
      onMouseLeave={() => setHover(null)}
      aria-label="Puan ver"
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fillRatio = Math.max(0, Math.min(1, shown - (i - 1)));
        return (
          <span key={i} className="star-input__star">
            <Star size={20} className="star-input__base" />
            <span
              className="star-input__fill"
              style={{ width: `${fillRatio * 100}%` }}
            >
              <Star size={20} fill="currentColor" />
            </span>
            <button
              type="button"
              disabled={disabled}
              className="star-input__hit star-input__hit--left"
              onMouseEnter={() => setHover(i - 0.5)}
              onFocus={() => setHover(i - 0.5)}
              onClick={() => onChange(value === i - 0.5 ? null : i - 0.5)}
              aria-label={`${(i - 0.5).toFixed(1)}`}
            />
            <button
              type="button"
              disabled={disabled}
              className="star-input__hit star-input__hit--right"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => onChange(value === i ? null : i)}
              aria-label={`${i.toFixed(1)}`}
            />
          </span>
        );
      })}
    </div>
  );
}

export default function ProfileFilmsTab() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("watched-desc");
  const [hasRating, setHasRating] = useState<string>("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("none");

  const { data, isLoading } = useQuery({
    queryKey: ["watched-films", page, sortBy, hasRating],
    queryFn: () =>
      profileService.getWatchedFilms({
        page,
        pageSize: 24,
        sortBy,
        hasRating: hasRating === "" ? undefined : hasRating === "true",
      }),
  });

  // Puan değiştirme artık doğrudan MovieRatings'i güncelleyen quick-rate
  // endpoint'ini kullanıyor — film izlenmiş olsun olmasın çalışır.
  const rateMutation = useMutation({
    mutationFn: ({
      movieId,
      value,
    }: {
      movieId: string;
      value: number | null;
    }) => movieService.upsertRating(movieId, value ?? 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched-films"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      closePanel();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (movieId: string) => profileService.removeWatchedFilm(movieId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched-films"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      closePanel();
    },
  });

  function closePanel() {
    setActiveId(null);
    setPanelMode("none");
  }

  function openPanel(id: string, mode: PanelMode) {
    setActiveId(id);
    setPanelMode(mode);
  }

  const groups = data ? groupEntries(data.items, sortBy, i18n.language) : null;

  const renderCard = (entry: WatchedMovie) => {
    const isActive = activeId === entry.movieId;
    const isRating = isActive && panelMode === "rate";
    const isDeleting = isActive && panelMode === "delete";

    return (
      <div
        key={entry.movieId}
        className={`films-grid__card${isActive ? " films-grid__card--active" : ""}`}
      >
        <Link
          to={`/movies/${entry.movie.id}`}
          className="films-grid__poster-wrap"
          tabIndex={isActive ? -1 : 0}
        >
          <img
            src={entry.movie.posterUrl}
            alt={entry.movie.title}
            className="films-grid__poster"
          />
        </Link>

        <div className="films-grid__scrim" />

        {entry.userRating !== null && !isActive && (
          <span className="films-grid__rating">
            <Star size={11} fill="currentColor" />
            {entry.userRating.toFixed(1)}
          </span>
        )}

        <div className="films-grid__meta">
          <p className="films-grid__title">{entry.movie.title}</p>
          <p className="films-grid__date">
            {new Date(entry.watchedAtUtc).toLocaleDateString(i18n.language, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        {!isActive && (
          <div className="films-grid__hover-actions">
            <button
              className="films-grid__icon-btn"
              onClick={() => openPanel(entry.movieId, "rate")}
              aria-label={t("profile.editRating")}
            >
              <Star size={13} />
            </button>
            <button
              className="films-grid__icon-btn films-grid__icon-btn--danger"
              onClick={() => openPanel(entry.movieId, "delete")}
              aria-label={t("common.delete")}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {isRating && (
          <div className="films-grid__panel">
            <p className="films-grid__panel-title">{t("profile.editRating")}</p>
            <StarRatingInput
              value={entry.userRating}
              disabled={rateMutation.isPending}
              onChange={(value) =>
                rateMutation.mutate({ movieId: entry.movieId, value })
              }
            />
            <button
              className="films-grid__panel-close"
              onClick={closePanel}
              aria-label={t("common.cancel")}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {isDeleting && (
          <div className="films-grid__panel films-grid__panel--danger">
            <p className="films-grid__panel-title">
              {t("profile.confirmRemoveWatched")}
            </p>
            <div className="films-grid__panel-row">
              <button
                className="films-grid__icon-btn films-grid__icon-btn--danger"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(entry.movieId)}
                aria-label={t("common.confirm")}
              >
                <Trash2 size={14} />
              </button>
              <button
                className="films-grid__icon-btn"
                onClick={closePanel}
                aria-label={t("common.cancel")}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="films-tab">
      <div className="films-tab__filters">
        <Dropdown
          value={sortBy}
          onChange={setSortBy}
          options={SORT_OPTIONS.map((o) => ({
            label: t(`profile.filmsSort.${o.label}`),
            value: o.value,
          }))}
        />
        <Dropdown
          value={hasRating}
          onChange={setHasRating}
          options={[
            { label: t("profile.filmsFilterAll"), value: "" },
            { label: t("profile.filmsFilterRated"), value: "true" },
            { label: t("profile.filmsFilterUnrated"), value: "false" },
          ]}
        />
      </div>

      {!isLoading && data && data.totalCount > 0 && (
        <p className="films-tab__count">
          {t("search.resultsCount", { count: data.totalCount })}
        </p>
      )}

      {!isLoading && data && data.items.length === 0 && (
        <EmptyState
          icon={<Star size={26} />}
          title={t("profile.emptyContent")}
          hint={t("profile.recentlyWatchedHint")}
        />
      )}

      {groups
        ? groups.map((group) => (
            <div key={group.label} className="films-grid__group">
              <p className="films-grid__group-label">{group.label}</p>
              <div className="films-grid">{group.items.map(renderCard)}</div>
            </div>
          ))
        : data && (
            <div className="films-grid">{data.items.map(renderCard)}</div>
          )}

      {data && data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          onChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}
