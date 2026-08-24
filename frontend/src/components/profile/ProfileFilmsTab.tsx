import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Star, Pencil, Trash2, Check, X } from "lucide-react";
import { profileService, screeningLogService } from "@/services";
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

const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const RATING_OPTIONS = [
  { label: "profile.notRated", value: "" },
  ...RATING_STEPS.map((v) => ({ label: v.toFixed(1), value: String(v) })),
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

// Watched-date sırasında aya göre, çıkış tarihi sırasında yıla göre grupla.
// Puan/başlık sıralamalarında gruplama yapılmaz, tek akış olarak gösterilir.
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

type PanelMode = "none" | "edit" | "delete";

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
        pageSize: 20,
        sortBy,
        hasRating: hasRating === "" ? undefined : hasRating === "true",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      watchedAtUtc,
      rating,
    }: {
      id: string;
      watchedAtUtc: string;
      rating: number | null;
    }) => screeningLogService.update(id, watchedAtUtc, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched-films"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      closePanel();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => screeningLogService.remove(id),
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
    const isActive = activeId === entry.id;
    const isEditing = isActive && panelMode === "edit";
    const isDeleting = isActive && panelMode === "delete";

    return (
      <div
        key={entry.id}
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
              onClick={() => openPanel(entry.id, "edit")}
              aria-label={t("common.edit")}
            >
              <Pencil size={13} />
            </button>
            <button
              className="films-grid__icon-btn films-grid__icon-btn--danger"
              onClick={() => openPanel(entry.id, "delete")}
              aria-label={t("common.delete")}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {isEditing && (
          <div className="films-grid__panel">
            <p className="films-grid__panel-title">{t("profile.editRating")}</p>
            <Dropdown
              value={entry.userRating != null ? String(entry.userRating) : ""}
              onChange={(v) => {
                const rating = v === "" ? null : Number(v);
                updateMutation.mutate({
                  id: entry.id,
                  watchedAtUtc: entry.watchedAtUtc,
                  rating,
                });
              }}
              options={RATING_OPTIONS.map((o) => ({
                label: o.value === "" ? t(o.label) : o.label,
                value: o.value,
              }))}
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
              {t("profile.confirmDeleteScreening")}
            </p>
            <div className="films-grid__panel-row">
              <button
                className="films-grid__icon-btn films-grid__icon-btn--danger"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(entry.id)}
                aria-label={t("common.confirm")}
              >
                <Check size={14} />
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
