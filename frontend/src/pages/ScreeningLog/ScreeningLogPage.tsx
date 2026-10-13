import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  Ticket,
  Plus,
  X,
  Star,
  Clapperboard,
  Pencil,
  Heart,
  HeartCrack,
  Search,
} from "lucide-react";
import { screeningLogService, movieService } from "@/services";
import { getEntityTheme } from "@/utils/listTheme";
import MovieSearchSelect from "@/components/admin/MovieSearchSelect";
import StarRating from "@/components/movie/StarRating";
import ReactionPicker from "@/components/movie/ReactionPicker";
import { useToast } from "@/components/common/Toast";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import type { ScreeningLogEntry, ScreeningLogDay, ReactionType } from "@/types";
import "./ScreeningLogPage.css";

type ReactionFilter = "all" | "liked" | "disliked";

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

/** Backend doğrulama hatalarında alan mesajlarını, yoksa title'ı, o da yoksa fallback'i döner. */
function apiErrorMessage(err: unknown, fallback: string): string {
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

/** Arama kutusu her tuşta istek atmasın diye değeri gecikmeli döner. */
function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 20;

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

interface EntryCardProps {
  entry: ScreeningLogEntry;
  onDelete: (id: string) => Promise<unknown>;
  onSave: (
    id: string,
    watchedAtUtc: string,
    rating: number | null,
  ) => Promise<unknown>;
  compact?: boolean;
}

function EntryCard({ entry, onDelete, onSave, compact }: EntryCardProps) {
  const { t } = useTranslation();
  const theme = getEntityTheme(entry.movieId);
  const accentStyle = { "--entry-accent": theme.accent } as React.CSSProperties;
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
    setIsSaving(true);
    try {
      await onSave(
        entry.id,
        `${draftDate}T12:00:00.000Z`,
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
    setIsDeleting(true);
    try {
      await onDelete(entry.id);
    } catch {
      setIsDeleting(false);
    }
  };

  if (isEditing) {
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
            max={todayLocalDateString()}
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
            <p className="screening-log__entry-review">{entry.reviewContent}</p>
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
      </div>

      {isConfirmingDelete && (
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

export default function ScreeningLogPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<ReactionFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const [selectedMovie, setSelectedMovie] = useState<{
    id: string;
    title: string;
    posterUrl: string;
  } | null>(null);
  const [watchedDate, setWatchedDate] = useState(todayLocalDateString());
  const [addRating, setAddRating] = useState(0);
  // undefined = kullanıcı dokunmadı (önceki tepki geçerli), null = bilerek temizledi
  const [addReaction, setAddReaction] = useState<
    ReactionType | null | undefined
  >(undefined);

  const reactionParam: ReactionType | undefined =
    filter === "liked" ? "Like" : filter === "disliked" ? "Dislike" : undefined;

  // Gün bazlı imleçli sayfalama: filtre/arama değişince anahtar değişir, liste baştan yüklenir.
  const logQuery = useInfiniteQuery({
    queryKey: [
      "screening-log",
      "list",
      { reaction: reactionParam ?? null, search: debouncedSearch },
    ],
    queryFn: ({ pageParam }) =>
      screeningLogService.getPage({
        cursor: pageParam,
        pageSize: PAGE_SIZE,
        reaction: reactionParam,
        search: debouncedSearch || undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  });

  // İstatistikler sayfalamadan bağımsız: tüm günlük üzerinden sunucuda hesaplanır.
  const summaryQuery = useQuery({
    queryKey: ["screening-log", "summary"],
    queryFn: screeningLogService.getSummary,
    staleTime: 30_000,
    retry: 1,
  });
  const summary = summaryQuery.data;

  const days = useMemo(
    () => logQuery.data?.pages.flatMap((p) => p.days) ?? [],
    [logQuery.data],
  );

  // Seçilen filmdeki önceki tepki: form onunla başlar.
  const { data: serverReaction, isLoading: isReactionLoading } = useQuery({
    queryKey: ["movie", selectedMovie?.id],
    queryFn: () => movieService.getById(selectedMovie!.id),
    select: (d) => d.currentUserReaction,
    enabled: !!selectedMovie,
    staleTime: 30_000,
  });
  const initialReaction: ReactionType | null = serverReaction ?? null;
  const reaction = addReaction === undefined ? initialReaction : addReaction;

  const invalidateAll = () => {
    // "screening-log" öneki hem liste hem özet sorgusunu kapsar.
    queryClient.invalidateQueries({ queryKey: ["screening-log"] });
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    queryClient.invalidateQueries({ queryKey: ["watched-films"] });
    queryClient.invalidateQueries({ queryKey: ["watched-films-counts"] });
    queryClient.invalidateQueries({ queryKey: ["movie"] });
  };

  const showError = (err: unknown) =>
    showToast(apiErrorMessage(err, t("common.genericError")), "error");

  const logMutation = useMutation({
    mutationFn: async () => {
      await screeningLogService.log(
        selectedMovie!.id,
        `${watchedDate}T12:00:00.000Z`,
        addRating > 0 ? addRating : null,
      );
      // Seans yazıldıktan sonra tepkiyi uygula; hata olursa seansı geri almıyoruz
      // (kullanıcı tekrar deneyip çift kayıt oluşturmasın), sadece haber veriyoruz.
      try {
        await movieService.setReaction(
          selectedMovie!.id,
          reaction,
          initialReaction,
        );
        return { reactionFailed: false };
      } catch {
        return { reactionFailed: true };
      }
    },
    onSuccess: ({ reactionFailed }) => {
      invalidateAll();
      if (reactionFailed) showToast(t("log.reactionSaveError"), "error");
      setSelectedMovie(null);
      setWatchedDate(todayLocalDateString());
      setAddRating(0);
      setAddReaction(undefined);
      setIsAdding(false);
    },
    onError: showError,
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
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => screeningLogService.remove(entryId),
    onSuccess: () => invalidateAll(),
    onError: showError,
  });

  const handleDelete = (id: string) => deleteMutation.mutateAsync(id);
  const handleSave = (
    id: string,
    watchedAtUtc: string,
    rating: number | null,
  ) => updateMutation.mutateAsync({ id, watchedAtUtc, rating });

  if (logQuery.isLoading || summaryQuery.isLoading)
    return <PageSpinner label={t("common.loading")} />;
  if (logQuery.isError)
    return (
      <PageError
        message={t("common.genericError")}
        onRetry={() => logQuery.refetch()}
      />
    );

  const locale = i18n.language === "tr" ? "tr-TR" : "en-US";
  const monthGroups = groupDaysByMonth(days, locale);
  const hasFilter = filter !== "all" || debouncedSearch !== "";
  // Filtre sonuç vermese bile günlükte kayıt varsa araç çubuğu kalmalı.
  const hasAnyEntries = summary
    ? summary.totalScreenings > 0
    : days.length > 0 || hasFilter;

  const filterOptions: { value: ReactionFilter; label: string }[] = [
    { value: "all", label: t("log.filterAll", "Tümü") },
    { value: "liked", label: t("log.filterLiked", "Beğendiklerim") },
    { value: "disliked", label: t("log.filterDisliked", "Bana göre değil") },
  ];

  return (
    <div className="container screening-log">
      <div className="screening-log__header">
        <div>
          <span className="screening-log__eyebrow">
            {t("log.eyebrow", "Film günlüğün")}
          </span>
          <h1>{t("log.pageTitle")}</h1>
          <p className="text-secondary">{t("log.pageSubtitle")}</p>
        </div>
        <button
          type="button"
          className={`btn-primary screening-log__add-btn${isAdding ? " is-open" : ""}`}
          aria-expanded={isAdding}
          aria-controls="screening-log-add-form"
          onClick={() => setIsAdding((s) => !s)}
        >
          <Plus size={15} /> {t("log.addEntry")}
        </button>
      </div>

      {summary && summary.totalScreenings > 0 && (
        <section
          className="screening-log__stats"
          aria-label={t("log.pageTitle")}
        >
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
            <span className="screening-log__stat-value">
              {summary.uniqueFilms}
            </span>
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
      )}

      {isAdding && (
        <div
          id="screening-log-add-form"
          className="screening-log__add-form card"
        >
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
                    onClick={() => {
                      setSelectedMovie(null);
                      setAddReaction(undefined);
                    }}
                  >
                    {t("log.changeMovie")}
                  </button>
                </div>
              ) : (
                <MovieSearchSelect
                  excludeUnreleased
                  onSelect={(movieId, title, posterUrl) => {
                    setSelectedMovie({ id: movieId, title, posterUrl });
                    setAddReaction(undefined);
                  }}
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
              type="button"
              className="btn-primary screening-log__add-submit"
              disabled={!selectedMovie || logMutation.isPending}
              onClick={() => logMutation.mutate()}
            >
              {t("log.addEntrySubmit")}
            </button>
          </div>

          <div className="screening-log__add-rating-row">
            <div className="screening-log__add-field">
              <label>{t("log.addEntryRating")}</label>
              <StarRating value={addRating} onChange={setAddRating} />
            </div>
            <div className="screening-log__add-field">
              <label>{t("log.reactionLabel")}</label>
              <ReactionPicker
                value={reaction}
                onChange={setAddReaction}
                disabled={
                  !selectedMovie || isReactionLoading || logMutation.isPending
                }
              />
            </div>
          </div>
        </div>
      )}

      {hasAnyEntries && (
        <div className="screening-log__toolbar">
          <div className="screening-log__filters" role="group">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`screening-log__pill${filter === opt.value ? " is-active" : ""}`}
                aria-pressed={filter === opt.value}
                onClick={() => setFilter(opt.value)}
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("log.searchPlaceholder", "Günlükte ara")}
              aria-label={t("log.searchPlaceholder", "Günlükte ara")}
            />
          </label>
        </div>
      )}

      {!hasAnyEntries ? (
        <EmptyState
          icon={<Ticket size={26} />}
          title={t("log.empty")}
          hint={t("log.emptyHint")}
        />
      ) : days.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title={t("log.noResults", "Eşleşen seans yok")}
          hint={t(
            "log.noResultsHint",
            "Filtreyi veya aramayı değiştirmeyi dene.",
          )}
        />
      ) : (
        <>
          <div
            className={`screening-log__timeline${logQuery.isPlaceholderData ? " is-stale" : ""}`}
            aria-busy={logQuery.isPlaceholderData}
          >
            {monthGroups.map((group, groupIndex) => {
              const count = group.days.reduce(
                (sum, d) => sum + d.entries.length,
                0,
              );
              // Son ay, sonraki sayfada devam ediyor olabilir: sayı eksik görünmesin diye gizlenir.
              const isPartial =
                groupIndex === monthGroups.length - 1 && logQuery.hasNextPage;
              return (
                <section
                  key={group.label}
                  className="screening-log__month-group"
                >
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
                              onDelete={handleDelete}
                              onSave={handleSave}
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
                              onDelete={handleDelete}
                              onSave={handleSave}
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
                              onDelete={handleDelete}
                              onSave={handleSave}
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

          {logQuery.hasNextPage && (
            <div className="screening-log__more">
              <button
                type="button"
                className="btn-secondary"
                disabled={logQuery.isFetchingNextPage}
                onClick={() => logQuery.fetchNextPage()}
              >
                {logQuery.isFetchingNextPage
                  ? t("common.loading")
                  : t("log.loadMore", "Daha fazla göster")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
