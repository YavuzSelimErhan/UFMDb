import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Plus, X, Star, Clapperboard, Pencil } from "lucide-react";
import { screeningLogService } from "@/services";
import { getEntityTheme } from "@/utils/listTheme";
import MovieSearchSelect from "@/components/admin/MovieSearchSelect";
import StarRating from "@/components/movie/StarRating";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import type { ScreeningLogEntry, ScreeningLogDay } from "@/types";
import "./ScreeningLogPage.css";

function todayLocalDateString(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

function toUtcDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function monthLabel(dateStr: string, locale: string): string {
  const date = toUtcDateOnly(dateStr);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function groupDaysByMonth(days: ScreeningLogDay[], locale: string) {
  const groups: { label: string; days: ScreeningLogDay[] }[] = [];
  for (const day of days) {
    const label = monthLabel(day.date, locale);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.days.push(day);
    else groups.push({ label, days: [day] });
  }
  return groups;
}

function DayLeaf({ dateStr, locale }: { dateStr: string; locale: string }) {
  const date = toUtcDateOnly(dateStr);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(date);
  const dayNum = date.getUTCDate();

  return (
    <div className="screening-log__leaf">
      <span className="screening-log__leaf-weekday">{weekday}</span>
      <span className="screening-log__leaf-day">{dayNum}</span>
      <span className="screening-log__leaf-month">{month}</span>
    </div>
  );
}

interface EntryCardProps {
  entry: ScreeningLogEntry;
  onDelete: (id: string) => void;
  onSave: (id: string, watchedAtUtc: string, rating: number | null) => void;
  compact?: boolean;
}

function EntryCard({ entry, onDelete, onSave, compact }: EntryCardProps) {
  const { t } = useTranslation();
  const theme = getEntityTheme(entry.movieId);
  const [isEditing, setIsEditing] = useState(false);
  const [draftDate, setDraftDate] = useState(entry.watchedAtUtc.slice(0, 10));
  const [draftRating, setDraftRating] = useState(entry.rating ?? 0);

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    setDraftDate(entry.watchedAtUtc.slice(0, 10));
    setDraftRating(entry.rating ?? 0);
    setIsEditing(true);
  };

  const save = (e: React.MouseEvent) => {
    e.preventDefault();
    onSave(
      entry.id,
      `${draftDate}T12:00:00.000Z`,
      draftRating > 0 ? draftRating : null,
    );
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div
        className="screening-log__entry screening-log__entry--editing"
        style={{ "--entry-accent": theme.accent } as React.CSSProperties}
      >
        <img
          src={entry.posterUrl}
          alt=""
          className="screening-log__entry-poster"
        />
        <div className="screening-log__entry-edit-body">
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            max={todayLocalDateString()}
          />
          <StarRating value={draftRating} onChange={setDraftRating} />
          <div className="screening-log__entry-edit-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsEditing(false)}
            >
              {t("common.cancel")}
            </button>
            <button type="button" className="btn-primary" onClick={save}>
              {t("log.saveEntry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`screening-log__entry ${compact ? "screening-log__entry--compact" : ""}`}
      style={{ "--entry-accent": theme.accent } as React.CSSProperties}
    >
      <Link
        to={`/movies/${entry.movieId}`}
        className="screening-log__entry-link"
      >
        <img
          src={entry.posterUrl}
          alt=""
          className="screening-log__entry-poster"
        />
        <div className="screening-log__entry-body">
          <h4>{entry.movieTitle}</h4>
          <div className="screening-log__entry-meta">
            {entry.rating != null && (
              <span className="screening-log__entry-rating">
                <Star size={12} fill="currentColor" /> {entry.rating.toFixed(1)}
              </span>
            )}
            {entry.screeningNumber > 1 && (
              <span className="screening-log__entry-rewatch">
                {t("log.rewatch", { count: entry.screeningNumber })}
              </span>
            )}
          </div>
          {entry.reviewContent && !compact && (
            <p className="screening-log__entry-review">{entry.reviewContent}</p>
          )}
        </div>
      </Link>
      <div className="screening-log__entry-actions">
        <button
          type="button"
          className="screening-log__entry-icon-btn"
          title={t("log.editEntry")}
          onClick={startEdit}
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          className="screening-log__entry-icon-btn screening-log__entry-icon-btn--danger"
          title={t("log.deleteEntry")}
          onClick={(e) => {
            e.preventDefault();
            onDelete(entry.id);
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

export default function ScreeningLogPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<{
    id: string;
    title: string;
    posterUrl: string;
  } | null>(null);
  const [watchedDate, setWatchedDate] = useState(todayLocalDateString());
  const [addRating, setAddRating] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["screening-log"],
    queryFn: screeningLogService.getAll,
    retry: 1,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["screening-log"] });
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    queryClient.invalidateQueries({ queryKey: ["movie"] });
  };

  const logMutation = useMutation({
    mutationFn: () =>
      screeningLogService.log(
        selectedMovie!.id,
        `${watchedDate}T12:00:00.000Z`,
        addRating > 0 ? addRating : null,
      ),
    onSuccess: () => {
      invalidateAll();
      setSelectedMovie(null);
      setWatchedDate(todayLocalDateString());
      setAddRating(0);
      setIsAdding(false);
    },
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
    onSuccess: () => invalidateAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => screeningLogService.remove(entryId),
    onSuccess: () => invalidateAll(),
  });

  if (isLoading) return <PageSpinner label={t("common.loading")} />;
  if (isError || !data)
    return (
      <PageError message={t("errors.genericError")} onRetry={() => refetch()} />
    );

  const locale = i18n.language === "tr" ? "tr-TR" : "en-US";
  const allEntries = data.flatMap((d) => d.entries);
  const monthGroups = groupDaysByMonth(data, locale);
  const uniqueFilmCount = new Set(allEntries.map((e) => e.movieId)).size;
  const ratedEntries = allEntries.filter((e) => e.rating != null);
  const avgRating =
    ratedEntries.length > 0
      ? (
          ratedEntries.reduce((sum, e) => sum + (e.rating ?? 0), 0) /
          ratedEntries.length
        ).toFixed(1)
      : "—";

  return (
    <div className="container screening-log">
      <div className="screening-log__header">
        <div>
          <h1>
            <Ticket size={22} /> {t("log.pageTitle")}
          </h1>
          <p className="text-muted">{t("log.pageSubtitle")}</p>
        </div>
        <button
          className="btn-secondary screening-log__add-btn"
          onClick={() => setIsAdding((s) => !s)}
        >
          <Plus size={15} /> {t("log.addEntry")}
        </button>
      </div>

      {allEntries.length > 0 && (
        <div className="screening-log__marquee">
          <div className="screening-log__marquee-stat">
            <span className="screening-log__marquee-value">
              {allEntries.length}
            </span>
            <span className="screening-log__marquee-label">
              {t("log.statScreenings")}
            </span>
          </div>
          <div className="screening-log__marquee-stat">
            <span className="screening-log__marquee-value">
              {uniqueFilmCount}
            </span>
            <span className="screening-log__marquee-label">
              {t("log.statUniqueFilms")}
            </span>
          </div>
          <div className="screening-log__marquee-stat">
            <span className="screening-log__marquee-value">
              {ratedEntries.length}
            </span>
            <span className="screening-log__marquee-label">
              {t("log.statRated")}
            </span>
          </div>
          <div className="screening-log__marquee-stat">
            <span className="screening-log__marquee-value">{avgRating}</span>
            <span className="screening-log__marquee-label">
              {t("log.statAvgRating")}
            </span>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="screening-log__add-form card">
          <span className="screening-log__add-form-eyebrow">
            <Ticket size={12} /> {t("log.boxOffice")}
          </span>

          <div className="screening-log__add-form-row">
            <div className="screening-log__add-poster-slot">
              {selectedMovie ? (
                <img src={selectedMovie.posterUrl} alt="" />
              ) : (
                <Ticket size={20} className="text-muted" />
              )}
            </div>

            <div className="screening-log__add-movie-slot">
              <label>{t("log.addEntryMovie")}</label>
              {selectedMovie ? (
                <div className="screening-log__add-selected-row">
                  <span className="screening-log__add-selected-title">
                    {selectedMovie.title}
                  </span>
                  <button
                    type="button"
                    className="screening-log__add-change-btn"
                    onClick={() => setSelectedMovie(null)}
                  >
                    {t("log.changeMovie")}
                  </button>
                </div>
              ) : (
                <MovieSearchSelect
                  onSelect={(movieId, title, posterUrl) =>
                    setSelectedMovie({ id: movieId, title, posterUrl })
                  }
                />
              )}
            </div>

            <div className="screening-log__add-date-slot">
              <label>{t("log.addEntryDate")}</label>
              <input
                type="date"
                value={watchedDate}
                onChange={(e) => setWatchedDate(e.target.value)}
                max={todayLocalDateString()}
              />
            </div>

            <button
              className="btn-primary screening-log__add-submit"
              disabled={!selectedMovie || logMutation.isPending}
              onClick={() => logMutation.mutate()}
            >
              {t("log.addEntrySubmit")}
            </button>
          </div>

          <div className="screening-log__add-rating-row">
            <label>{t("log.addEntryRating")}</label>
            <StarRating value={addRating} onChange={setAddRating} />
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <EmptyState
          icon={<Ticket size={26} />}
          title={t("log.empty")}
          hint={t("log.emptyHint")}
        />
      ) : (
        <div className="screening-log__timeline">
          {monthGroups.map((group) => (
            <div key={group.label} className="screening-log__month-group">
              <div className="screening-log__month-divider">
                <span>{group.label}</span>
              </div>
              {group.days.map((day) => (
                <div key={day.date} className="screening-log__day-row">
                  <DayLeaf dateStr={day.date} locale={locale} />

                  {day.entries.length === 2 ? (
                    <div className="screening-log__double-feature">
                      <span className="screening-log__double-feature-label">
                        <Ticket size={11} /> {t("log.doubleFeature")}
                      </span>
                      <div className="screening-log__double-feature-halves">
                        <EntryCard
                          entry={day.entries[0]}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          onSave={(id, watchedAtUtc, rating) =>
                            updateMutation.mutate({ id, watchedAtUtc, rating })
                          }
                          compact
                        />
                        <div
                          className="screening-log__double-feature-divider"
                          aria-hidden="true"
                        >
                          <Clapperboard size={12} />
                        </div>
                        <EntryCard
                          entry={day.entries[1]}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          onSave={(id, watchedAtUtc, rating) =>
                            updateMutation.mutate({ id, watchedAtUtc, rating })
                          }
                          compact
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="screening-log__day-entries">
                      {day.entries.map((entry) => (
                        <EntryCard
                          key={entry.id}
                          entry={entry}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          onSave={(id, watchedAtUtc, rating) =>
                            updateMutation.mutate({ id, watchedAtUtc, rating })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
