import { localScreeningDate } from "@/utils/screeningTime";
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Ticket,
  X,
  Star,
  Clapperboard,
  Pencil,
  Heart,
  HeartCrack,
  Search,
  EyeOff,
} from "lucide-react";
import { getEntityTheme } from "@/utils/listTheme";
import StarRating from "@/components/movie/StarRating";
import type {
  ScreeningLogEntry,
  ScreeningLogDay,
  ScreeningLogSummary,
  ReactionType,
} from "@/types";
import "./ScreeningLogPage.css";

// Bu dosya hem kendi defterin (ScreeningLogPage) hem başkasının defteri (UserScreeningLog)
// tarafından kullanılan ortak parçaları içerir.

export type ReactionFilter = "all" | "liked" | "disliked";

export const SCREENING_LOG_PAGE_SIZE = 20;

export function reactionFromFilter(
  filter: ReactionFilter,
): ReactionType | undefined {
  return filter === "liked"
    ? "Like"
    : filter === "disliked"
      ? "Dislike"
      : undefined;
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

/** Backend doğrulama hatalarında alan mesajlarını, yoksa title'ı, o da yoksa fallback'i döner. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (
    err as {
      response?: {
        data?: { title?: string; errors?: Record<string, string[]> };
      };
    }
  )?.response?.data;
  const fieldMessages = data?.errors ? Object.values(data.errors).flat() : [];
  return fieldMessages.length > 0
    ? fieldMessages.join(" ")
    : (data?.title ?? fallback);
}

export function httpStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

/** Arama kutusu her tuşta istek atmasın diye değeri gecikmeli döner. */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
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

/** Filmin güncel tepkisi (film başına tek, seansa özel değil). */
function ReactionMark({
  reaction,
}: {
  reaction: ReactionType | null | undefined;
}) {
  const { t } = useTranslation();
  if (!reaction) return null;
  const isLike = reaction === "Like";
  const label = isLike ? t("movie.liked", "Beğenildi") : t("movie.notForMe");
  return (
    <span
      className={`screening-log__reaction ${isLike ? "is-like" : "is-dislike"}`}
    >
      {isLike ? (
        <Heart size={15} fill="currentColor" aria-hidden="true" />
      ) : (
        <HeartCrack size={15} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

function EntryPoster({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className="screening-log__entry-poster screening-log__entry-poster--fallback"
        aria-hidden="true"
      >
        <Clapperboard size={18} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="screening-log__entry-poster"
      width={68}
      height={98}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/** İnceleme metni; spoiler içeriyorsa tıklanana kadar gizli kalır. */
function ReviewText({
  content,
  containsSpoiler,
}: {
  content: string;
  containsSpoiler: boolean;
}) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  if (containsSpoiler && !revealed) {
    return (
      <button
        type="button"
        className="screening-log__entry-spoiler"
        onClick={(e) => {
          // Kart bir <Link> içinde: tıklama filme gitmesin.
          e.preventDefault();
          e.stopPropagation();
          setRevealed(true);
        }}
      >
        <EyeOff size={13} aria-hidden="true" />
        {t("log.spoilerReveal", "Spoiler içeriyor, göstermek için tıkla")}
      </button>
    );
  }
  return <p className="screening-log__entry-review">{content}</p>;
}

interface EntryCardProps {
  entry: ScreeningLogEntry;
  /** true ise düzenleme/silme yok (başkasının defteri). */
  readOnly?: boolean;
  onDelete?: (id: string) => Promise<unknown>;
  onSave?: (
    id: string,
    watchedAtUtc: string,
    rating: number | null,
  ) => Promise<unknown>;
  compact?: boolean;
}

export function EntryCard({
  entry,
  readOnly,
  onDelete,
  onSave,
  compact,
}: EntryCardProps) {
  const { t } = useTranslation();
  const canEdit = !readOnly && !!onSave && !!onDelete;
  const theme = getEntityTheme(entry.movieId);
  const accentStyle = { "--entry-accent": theme.accent } as CSSProperties;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draftDate, setDraftDate] = useState(entry.watchedAtUtc.slice(0, 10));
  const [draftRating, setDraftRating] = useState(entry.rating ?? 0);

  const startEdit = () => {
    setDraftDate(entry.watchedAtUtc.slice(0, 10));
    setDraftRating(entry.rating ?? 0);
    setIsEditing(true);
  };

  const save = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(
        entry.id,
        draftDate === entry.watchedAtUtc.slice(0, 10)
          ? entry.watchedAtUtc
          : new Date(draftDate).toISOString(),
        draftRating > 0 ? draftRating : null,
      );
      setIsEditing(false);
    } catch {
      // Hata toast'ı üstteki mutation'da gösteriliyor; düzenleme açık kalır.
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(entry.id);
    } catch {
      setIsDeleting(false);
    }
  };

  if (canEdit && isEditing) {
    return (
      <div
        className="screening-log__entry screening-log__entry--editing"
        style={accentStyle}
      >
        <EntryPoster src={entry.posterUrl} />
        <div className="screening-log__entry-edit-body">
          <h4 className="screening-log__entry-edit-title">
            {entry.movieTitle}
          </h4>
          <input
            type="date"
            aria-label={t("log.addEntryDate")}
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            max={localScreeningDate()}
          />
          <StarRating value={draftRating} onChange={setDraftRating} />
          <div className="screening-log__entry-edit-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={isSaving}
              onClick={() => setIsEditing(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isSaving || !draftDate}
              onClick={save}
            >
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
      style={accentStyle}
    >
      <Link
        to={`/movies/${entry.movieId}`}
        className="screening-log__entry-link"
      >
        <EntryPoster src={entry.posterUrl} />
        <div className="screening-log__entry-body">
          <h4>{entry.movieTitle}</h4>
          {entry.screeningNumber > 1 && (
            <span className="screening-log__entry-rewatch">
              {t("log.rewatch", { count: entry.screeningNumber })}
            </span>
          )}
          {entry.reviewContent && !compact && (
            <ReviewText
              content={entry.reviewContent}
              containsSpoiler={entry.reviewContainsSpoiler ?? false}
            />
          )}
        </div>
      </Link>

      <div className="screening-log__entry-side">
        {entry.rating != null && (
          <span
            className="screening-log__score"
            role="img"
            aria-label={`${entry.rating.toFixed(1)} / 5`}
          >
            <Star size={15} fill="currentColor" aria-hidden="true" />
            {entry.rating.toFixed(1)}
          </span>
        )}
        <ReactionMark reaction={entry.reaction} />
        {canEdit && (
          <div className="screening-log__entry-actions">
            <button
              type="button"
              className="screening-log__entry-icon-btn"
              title={t("log.editEntry")}
              aria-label={t("log.editEntry")}
              onClick={startEdit}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className="screening-log__entry-icon-btn screening-log__entry-icon-btn--danger"
              title={t("log.deleteEntry")}
              aria-label={t("log.deleteEntry")}
              onClick={() => setIsConfirmingDelete(true)}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {canEdit && isConfirmingDelete && (
        <div
          className="screening-log__entry-confirm"
          role="group"
          aria-label={t("log.confirmDeleteEntry", "Bu seans silinsin mi?")}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !isDeleting) setIsConfirmingDelete(false);
          }}
        >
          <span>{t("log.confirmDeleteEntry", "Bu seans silinsin mi?")}</span>
          <div className="screening-log__entry-confirm-actions">
            <button
              type="button"
              className="btn-secondary"
              autoFocus
              disabled={isDeleting}
              onClick={() => setIsConfirmingDelete(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="screening-log__entry-confirm-delete"
              disabled={isDeleting}
              onClick={confirmDelete}
            >
              {t("common.delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScreeningLogStats({
  summary,
}: {
  summary: ScreeningLogSummary;
}) {
  const { t } = useTranslation();
  return (
    <section className="screening-log__stats" aria-label={t("log.pageTitle")}>
      <div className="card screening-log__stat">
        <span className="screening-log__stat-label">
          {t("log.statScreenings")}
        </span>
        <span className="screening-log__stat-value">
          {summary.totalScreenings}
        </span>
      </div>
      <div className="card screening-log__stat">
        <span className="screening-log__stat-label">
          {t("log.statUniqueFilms")}
        </span>
        <span className="screening-log__stat-value">{summary.uniqueFilms}</span>
      </div>
      <div className="card screening-log__stat">
        <span className="screening-log__stat-label">
          {t("log.statAvgRating")}
        </span>
        <span className="screening-log__stat-value is-accent">
          {summary.averageRating != null
            ? summary.averageRating.toFixed(1)
            : "—"}
        </span>
      </div>
      <div className="card screening-log__stat">
        <span className="screening-log__stat-label">
          {t("log.statReactions", "Beğeni / Bana göre değil")}
        </span>
        <span className="screening-log__stat-value">
          <span className="is-like">{summary.likedFilms}</span>
          <span className="screening-log__stat-sep"> / </span>
          <span className="is-dislike">{summary.notForMeFilms}</span>
        </span>
      </div>
    </section>
  );
}

interface ToolbarProps {
  filter: ReactionFilter;
  onFilterChange: (f: ReactionFilter) => void;
  search: string;
  onSearchChange: (s: string) => void;
}

export function ScreeningLogToolbar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: ToolbarProps) {
  const { t } = useTranslation();
  const filterOptions: { value: ReactionFilter; label: string }[] = [
    { value: "all", label: t("log.filterAll", "Tümü") },
    { value: "liked", label: t("log.filterLiked", "Beğendiklerim") },
    { value: "disliked", label: t("log.filterDisliked", "Bana göre değil") },
  ];

  return (
    <div className="screening-log__toolbar">
      <div className="screening-log__filters" role="group">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`screening-log__pill${filter === opt.value ? " is-active" : ""}`}
            aria-pressed={filter === opt.value}
            onClick={() => onFilterChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <label className="screening-log__search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("log.searchPlaceholder", "Günlükte ara")}
          aria-label={t("log.searchPlaceholder", "Günlükte ara")}
        />
      </label>
    </div>
  );
}

interface TimelineProps {
  days: ScreeningLogDay[];
  locale: string;
  isStale?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore: () => void;
  readOnly?: boolean;
  onDelete?: (id: string) => Promise<unknown>;
  onSave?: (
    id: string,
    watchedAtUtc: string,
    rating: number | null,
  ) => Promise<unknown>;
}

export function ScreeningLogTimeline({
  days,
  locale,
  isStale,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  readOnly,
  onDelete,
  onSave,
}: TimelineProps) {
  const { t } = useTranslation();
  const monthGroups = groupDaysByMonth(days, locale);
  const cardProps = { readOnly, onDelete, onSave };

  return (
    <>
      <div
        className={`screening-log__timeline${isStale ? " is-stale" : ""}`}
        aria-busy={isStale}
      >
        {monthGroups.map((group, groupIndex) => {
          const count = group.days.reduce(
            (sum, d) => sum + d.entries.length,
            0,
          );
          // Son ay, sonraki sayfada devam ediyor olabilir: sayı eksik görünmesin diye gizlenir.
          const isPartial =
            groupIndex === monthGroups.length - 1 && hasNextPage;
          return (
            <section key={group.label} className="screening-log__month-group">
              <div className="screening-log__month-heading">
                <h2>{group.label}</h2>
                {!isPartial && (
                  <span className="text-muted">
                    {t("log.monthCount", {
                      count,
                      defaultValue: "{{count}} seans",
                    })}
                  </span>
                )}
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
                          {...cardProps}
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
                          {...cardProps}
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
                          {...cardProps}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          );
        })}
      </div>

      {hasNextPage && (
        <div className="screening-log__more">
          <button
            type="button"
            className="btn-secondary"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage
              ? t("common.loading")
              : t("log.loadMore", "Daha fazla göster")}
          </button>
        </div>
      )}
    </>
  );
}
