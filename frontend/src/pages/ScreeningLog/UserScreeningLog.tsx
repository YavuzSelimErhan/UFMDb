import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { Lock, Search, Ticket } from "lucide-react";
import { followService } from "@/services";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import type { DiaryVisibility } from "@/types";
import {
  ScreeningLogStats,
  ScreeningLogToolbar,
  ScreeningLogTimeline,
  SCREENING_LOG_PAGE_SIZE,
  httpStatus,
  reactionFromFilter,
  useDebouncedValue,
  type ReactionFilter,
} from "./ScreeningLogTimeline";
import "./ScreeningLogPage.css";

/** Defter bu izleyiciye kapalıyken gösterilen durum (Private / takipçi değil). */
export function DiaryLocked({ visibility }: { visibility: DiaryVisibility }) {
  const { t } = useTranslation();
  const followersOnly = visibility === "Followers";
  return (
    <EmptyState
      icon={<Lock size={26} />}
      title={
        followersOnly
          ? t("log.lockedFollowersTitle", "Defter yalnızca takipçilere açık")
          : t("log.lockedPrivateTitle", "Bu defter gizli")
      }
      hint={
        followersOnly
          ? t("log.lockedFollowersHint", "Görmek için kullanıcıyı takip et.")
          : undefined
      }
    />
  );
}

interface Props {
  userName: string;
  visibility: DiaryVisibility;
}

/** Başka bir kullanıcının Seans Defteri (salt okunur). */
export default function UserScreeningLog({ userName, visibility }: Props) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<ReactionFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const reactionParam = reactionFromFilter(filter);

  // 403/404 tekrar denemekle düzelmez; diğer hatalarda bir kez daha dene.
  const retry = (count: number, err: unknown) => {
    const status = httpStatus(err);
    return status !== 403 && status !== 404 && count < 1;
  };

  const logQuery = useInfiniteQuery({
    queryKey: [
      "user-screening-log",
      userName,
      "list",
      { reaction: reactionParam ?? null, search: debouncedSearch },
    ],
    queryFn: ({ pageParam }) =>
      followService.getUserScreeningLog(userName, {
        cursor: pageParam,
        pageSize: SCREENING_LOG_PAGE_SIZE,
        reaction: reactionParam,
        search: debouncedSearch || undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry,
  });

  const summaryQuery = useQuery({
    queryKey: ["user-screening-log", userName, "summary"],
    queryFn: () => followService.getUserScreeningLogSummary(userName),
    staleTime: 30_000,
    retry,
  });
  const summary = summaryQuery.data;

  const days = useMemo(
    () => logQuery.data?.pages.flatMap((p) => p.days) ?? [],
    [logQuery.data],
  );

  if (logQuery.isLoading || summaryQuery.isLoading)
    return <PageSpinner label={t("common.loading")} />;

  if (logQuery.isError) {
    // Profil önbelleği bayatsa (örn. takipten çıkıldı) sunucu 403 döner: kilitli durumu göster.
    if (httpStatus(logQuery.error) === 403)
      return <DiaryLocked visibility={visibility} />;
    return (
      <PageError
        message={t("common.genericError")}
        onRetry={() => logQuery.refetch()}
      />
    );
  }

  const locale = i18n.language === "tr" ? "tr-TR" : "en-US";
  const hasFilter = filter !== "all" || debouncedSearch !== "";
  const hasAnyEntries = summary
    ? summary.totalScreenings > 0
    : days.length > 0 || hasFilter;

  return (
    <div className="screening-log">
      {summary && summary.totalScreenings > 0 && (
        <ScreeningLogStats summary={summary} />
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
          title={t("log.userEmpty", "Bu defterde henüz seans yok")}
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
          readOnly
          isStale={logQuery.isPlaceholderData}
          hasNextPage={logQuery.hasNextPage}
          isFetchingNextPage={logQuery.isFetchingNextPage}
          onLoadMore={() => logQuery.fetchNextPage()}
        />
      )}
    </div>
  );
}
