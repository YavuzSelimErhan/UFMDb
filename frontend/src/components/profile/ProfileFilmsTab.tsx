import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Star, Pencil, Trash2, Calendar, Check, X } from "lucide-react";
import { profileService, screeningLogService } from "@/services";
import Dropdown from "@/components/search/Dropdown";
import Pagination from "@/components/common/Pagination";
import { EmptyState } from "@/components/common/PageState";
import type { WatchedMovie } from "@/types";
import "./ProfileFilmsTab.css";

const SORT_OPTIONS = [
  { label: "watchedDesc", value: "watched-desc" },
  { label: "watchedAsc", value: "watched-asc" },
  { label: "ratingDesc", value: "rating-desc" },
  { label: "ratingAsc", value: "rating-asc" },
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

function groupByMonth(items: WatchedMovie[], locale: string) {
  const groups: { label: string; items: WatchedMovie[] }[] = [];
  for (const item of items) {
    const label = monthLabel(item.watchedAtUtc, locale);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export default function ProfileFilmsTab() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("watched-desc");
  const [hasRating, setHasRating] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

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
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => screeningLogService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watched-films"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setConfirmingDeleteId(null);
    },
  });

  const canGroupByMonth = sortBy === "watched-desc" || sortBy === "watched-asc";
  const groups =
    data && canGroupByMonth ? groupByMonth(data.items, i18n.language) : null;

  const renderRow = (entry: WatchedMovie) => {
    const isEditing = editingId === entry.id;
    const isConfirmingDelete = confirmingDeleteId === entry.id;

    return (
      <div key={entry.id} className="films-tab__row card">
        <Link
          to={`/movies/${entry.movie.id}`}
          className="films-tab__poster-link"
        >
          <img
            src={entry.movie.posterUrl}
            alt={entry.movie.title}
            className="films-tab__poster"
          />
        </Link>

        <Link to={`/movies/${entry.movie.id}`} className="films-tab__info">
          <p className="films-tab__title">{entry.movie.title}</p>
          <p className="films-tab__date text-muted">
            <Calendar size={12} />
            {new Date(entry.watchedAtUtc).toLocaleDateString()}
          </p>
        </Link>

        {isEditing ? (
          <div className="films-tab__edit">
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
              className="films-tab__icon-btn"
              onClick={() => setEditingId(null)}
              aria-label={t("common.cancel")}
            >
              <X size={14} />
            </button>
          </div>
        ) : isConfirmingDelete ? (
          <div className="films-tab__confirm-delete">
            <span>{t("profile.confirmDeleteScreening")}</span>
            <button
              className="films-tab__icon-btn films-tab__icon-btn--danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(entry.id)}
              aria-label={t("common.confirm")}
            >
              <Check size={14} />
            </button>
            <button
              className="films-tab__icon-btn"
              onClick={() => setConfirmingDeleteId(null)}
              aria-label={t("common.cancel")}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            {entry.userRating !== null ? (
              <span className="films-tab__rating">
                <Star size={13} fill="currentColor" />{" "}
                {entry.userRating.toFixed(1)}
              </span>
            ) : (
              <span className="films-tab__unrated text-muted">
                {t("profile.notRated")}
              </span>
            )}

            <div className="films-tab__actions">
              <button
                className="films-tab__icon-btn"
                onClick={() => setEditingId(entry.id)}
                aria-label={t("common.edit")}
              >
                <Pencil size={14} />
              </button>
              <button
                className="films-tab__icon-btn films-tab__icon-btn--danger"
                onClick={() => setConfirmingDeleteId(entry.id)}
                aria-label={t("common.delete")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
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

      <div className="films-tab__list">
        {groups
          ? groups.map((group) => (
              <div key={group.label} className="films-tab__group">
                <p className="films-tab__group-label">{group.label}</p>
                {group.items.map(renderRow)}
              </div>
            ))
          : data?.items.map(renderRow)}
      </div>

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
