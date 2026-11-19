import { localScreeningTime } from "@/utils/screeningTime";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Ticket, Plus, Search } from "lucide-react";
import { screeningLogService, movieService } from "@/services";
import MovieSearchSelect from "@/components/admin/MovieSearchSelect";
import StarRating from "@/components/movie/StarRating";
import ReactionPicker from "@/components/movie/ReactionPicker";
import { useToast } from "@/components/common/Toast";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import type { ReactionType } from "@/types";
import {
  ScreeningLogStats,
  ScreeningLogToolbar,
  ScreeningLogTimeline,
  SCREENING_LOG_PAGE_SIZE,
  apiErrorMessage,
  reactionFromFilter,
  useDebouncedValue,
  type ReactionFilter,
} from "./ScreeningLogTimeline";
import "./ScreeningLogPage.css";

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
  const [watchedDate, setWatchedDate] = useState(localScreeningTime());
  const [addRating, setAddRating] = useState(0);
  // undefined = kullanıcı dokunmadı (önceki tepki geçerli), null = bilerek temizledi
  const [addReaction, setAddReaction] = useState<
    ReactionType | null | undefined
  >(undefined);

  const reactionParam = reactionFromFilter(filter);

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
        pageSize: SCREENING_LOG_PAGE_SIZE,
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
        new Date(watchedDate).toISOString(),
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
      setWatchedDate(localScreeningTime());
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
  const hasFilter = filter !== "all" || debouncedSearch !== "";
  // Filtre sonuç vermese bile günlükte kayıt varsa araç çubuğu kalmalı.
  const hasAnyEntries = summary
    ? summary.totalScreenings > 0
    : days.length > 0 || hasFilter;

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
        <ScreeningLogStats summary={summary} />
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
                type="datetime-local"
                value={watchedDate}
                onChange={(e) => setWatchedDate(e.target.value)}
                max={localScreeningTime()}
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
        <ScreeningLogToolbar
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={setSearch}
        />
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
        <ScreeningLogTimeline
          days={days}
          locale={locale}
          isStale={logQuery.isPlaceholderData}
          hasNextPage={logQuery.hasNextPage}
          isFetchingNextPage={logQuery.isFetchingNextPage}
          onLoadMore={() => logQuery.fetchNextPage()}
          onDelete={handleDelete}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
