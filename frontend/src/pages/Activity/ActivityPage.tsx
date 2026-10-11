import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Film,
  Heart,
  HeartCrack,
  Star,
  Ticket,
  UserPlus,
} from "lucide-react";
import { feedService } from "@/services";
import PersonAvatar from "@/components/common/PersonAvatar";
import {
  EmptyState,
  PageError,
  PageSpinner,
} from "@/components/common/PageState";
import type { ActivityFeedItem, ActivityFilter } from "@/types";
import "./ActivityPage.css";

const PAGE_SIZE = 20;
const FILTERS: ActivityFilter[] = [
  "all",
  "reviews",
  "ratings",
  "diary",
  "reactions",
];
const FILTER_LABEL_KEYS: Record<ActivityFilter, string> = {
  all: "activityPage.filters.all",
  reviews: "activityPage.filters.reviews",
  ratings: "activityPage.filters.ratings",
  diary: "activityPage.filters.diary",
  reactions: "activityPage.filters.reactions",
};

type VerbKind =
  | "rated"
  | "watched"
  | "watchedAndRated"
  | "liked"
  | "disliked"
  | "reviewed"
  | "ratedAndReviewed";

/** [başkası, sen] — "Elif puanladı" / "Sen puanladın" (Türkçede fiil çekimi değişiyor). */
const VERB_KEYS: Record<VerbKind, readonly [string, string]> = {
  rated: ["activityPage.verbs.rated", "activityPage.verbsYou.rated"],
  watched: ["activityPage.verbs.watched", "activityPage.verbsYou.watched"],
  watchedAndRated: [
    "activityPage.verbs.watchedAndRated",
    "activityPage.verbsYou.watchedAndRated",
  ],
  liked: ["activityPage.verbs.liked", "activityPage.verbsYou.liked"],
  disliked: ["activityPage.verbs.disliked", "activityPage.verbsYou.disliked"],
  reviewed: ["activityPage.verbs.reviewed", "activityPage.verbsYou.reviewed"],
  ratedAndReviewed: [
    "activityPage.verbs.ratedAndReviewed",
    "activityPage.verbsYou.ratedAndReviewed",
  ],
};

function parseFilter(v: string | null): ActivityFilter {
  return FILTERS.includes(v as ActivityFilter) ? (v as ActivityFilter) : "all";
}

function getVerbKind(a: ActivityFeedItem): VerbKind {
  if (a.hasReview) return a.rating != null ? "ratedAndReviewed" : "reviewed";
  if (a.watched) return a.rating != null ? "watchedAndRated" : "watched";
  if (a.rating != null) return "rated";
  if (a.reaction === "Dislike") return "disliked";
  return "liked";
}

/* ---------- tarih/saat yardımcıları ---------- */

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function dayDiff(iso: string): number {
  return Math.round(
    (startOfDay(new Date()) - startOfDay(new Date(iso))) / 86400000,
  );
}

function dayLabel(iso: string, locale: string): string {
  const diff = dayDiff(iso);
  const d = new Date(iso);
  let label: string;
  if (diff === 0 || diff === 1) {
    label = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      diff === 0 ? 0 : -1,
      "day",
    );
  } else {
    label = d.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      ...(d.getFullYear() !== new Date().getFullYear()
        ? { year: "numeric" as const }
        : {}),
    });
  }
  return label.toLocaleUpperCase(locale);
}

/** Bugün: "2 saat önce"; diğer günler: gün başlığı zaten var, sadece saat. */
function rowTime(iso: string, locale: string): string {
  if (dayDiff(iso) === 0) {
    const diffMin = Math.max(
      0,
      Math.round((Date.now() - new Date(iso).getTime()) / 60000),
    );
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (diffMin < 1) return rtf.format(0, "minute");
    if (diffMin < 60) return rtf.format(-diffMin, "minute");
    return rtf.format(-Math.round(diffMin / 60), "hour");
  }
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface DayGroup {
  key: string;
  label: string;
  items: ActivityFeedItem[];
}

function groupByDay(items: ActivityFeedItem[], locale: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const item of items) {
    const d = new Date(item.lastActivityAtUtc);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({
        key,
        label: dayLabel(item.lastActivityAtUtc, locale),
        items: [item],
      });
    }
  }
  return groups;
}

/* ---------- küçük parçalar ---------- */

function Stars({ value }: { value: number }) {
  return (
    <span
      className="activity-page__stars"
      role="img"
      aria-label={value.toFixed(1)}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="activity-page__star">
            <Star size={15} className="activity-page__star-base" />
            <span
              className="activity-page__star-fill"
              style={{ width: `${fill * 100}%` }}
            >
              <Star size={15} fill="currentColor" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Poster({ item }: { item: ActivityFeedItem }) {
  const [failed, setFailed] = useState(false);
  const { movie } = item;
  const showFallback = !movie.posterUrl || failed;
  return (
    <Link to={`/movies/${movie.id}`} className="activity-page__poster">
      {showFallback ? (
        <span className="activity-page__poster-fallback">
          <Film size={18} />
        </span>
      ) : (
        <img
          src={movie.posterUrl}
          alt={movie.title}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </Link>
  );
}

function ActivityRow({ item }: { item: ActivityFeedItem }) {
  const { t, i18n } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  const you = item.isCurrentUser;
  const name = you
    ? t("activityPage.you")
    : item.user.fullName || item.user.userName;
  const profileHref = you ? "/profile" : `/users/${item.user.userName}`;
  const verb = t(VERB_KEYS[getVerbKind(item)][you ? 1 : 0]);
  const year = item.movie.releaseYear > 0 ? item.movie.releaseYear : null;
  const hideReview = item.containsSpoiler && !revealed;

  return (
    <article className={`activity-page__row${you ? " is-you" : ""}`}>
      <Poster item={item} />
      <div className="activity-page__body">
        <div className="activity-page__line-wrap">
          <Link
            to={profileHref}
            className="activity-page__avatar"
            aria-label={name}
          >
            <PersonAvatar
              id={item.user.id}
              photoUrl={item.user.avatarUrl}
              fullName={name}
              size="sm"
            />
          </Link>
          <p className="activity-page__line">
            <Link to={profileHref} className="activity-page__name">
              {name}
            </Link>{" "}
            {verb}{" "}
            <Link
              to={`/movies/${item.movie.id}`}
              className="activity-page__movie"
            >
              {item.movie.title}
            </Link>
            {year && <span className="activity-page__year"> {year}</span>}
          </p>
          <time
            className="activity-page__time"
            dateTime={item.lastActivityAtUtc}
          >
            {rowTime(item.lastActivityAtUtc, i18n.language)}
          </time>
        </div>

        {(item.rating != null || item.reaction || item.watched) && (
          <div className="activity-page__meta">
            {item.rating != null && (
              <>
                <Stars value={item.rating} />
                <span className="activity-page__rating">
                  {item.rating.toFixed(1)}
                </span>
              </>
            )}
            {item.reaction === "Like" && (
              <span className="activity-page__chip activity-page__chip--like">
                <Heart size={13} fill="currentColor" />
                {t("friendsActivity.reactionLike")}
              </span>
            )}
            {item.reaction === "Dislike" && (
              <span className="activity-page__chip activity-page__chip--dislike">
                <HeartCrack size={13} />
                {t("friendsActivity.reactionDislike")}
              </span>
            )}
            {item.watched && (
              <span className="activity-page__chip">
                <Ticket size={13} />
                {t("friendsActivity.watched")}
              </span>
            )}
          </div>
        )}

        {item.hasReview && item.reviewContent && !hideReview && (
          <blockquote className="activity-page__quote">
            {item.reviewContent}
          </blockquote>
        )}
        {item.hasReview && hideReview && (
          <div className="activity-page__spoiler">
            <span>{t("activityPage.spoilerHidden")}</span>
            <button type="button" onClick={() => setRevealed(true)}>
              {t("reviews.revealSpoiler")}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ---------- sayfa ---------- */

export default function ActivityPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseFilter(searchParams.get("type"));

  const {
    data,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["activity-feed", filter],
    queryFn: ({ pageParam }) =>
      feedService.getActivity({
        type: filter,
        before: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.hasMore && last.nextBefore ? last.nextBefore : undefined,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const setFilter = (f: ActivityFilter) => {
    const next = new URLSearchParams(searchParams);
    if (f === "all") next.delete("type");
    else next.set("type", f);
    setSearchParams(next, { replace: true });
  };

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );
  const groups = useMemo(
    () => groupByDay(items, i18n.language),
    [items, i18n.language],
  );
  const followingCount = data?.pages[0]?.followingCount ?? null;
  const dimmed = isFetching && !isFetchingNextPage && !isLoading;

  return (
    <div className="container activity-page">
      <div className="activity-page__inner">
        <p className="activity-page__eyebrow">{t("friendsActivity.eyebrow")}</p>
        <h1 className="activity-page__title">{t("activityPage.title")}</h1>
        <p className="activity-page__subtitle">{t("activityPage.subtitle")}</p>

        <div
          className="activity-page__pills"
          role="group"
          aria-label={t("activityPage.filtersAria")}
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`activity-page__pill${filter === f ? " is-active" : ""}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {t(FILTER_LABEL_KEYS[f])}
            </button>
          ))}
        </div>

        {followingCount === 0 && (
          <div className="activity-page__nudge">
            <UserPlus size={20} aria-hidden="true" />
            <div>
              <h2>{t("activityPage.findFriendsTitle")}</h2>
              <p>{t("activityPage.findFriendsText")}</p>
            </div>
            <Link to="/users" className="btn-primary">
              {t("friendsActivity.findCta")}
            </Link>
          </div>
        )}

        {isLoading && <PageSpinner label={t("common.loading")} />}

        {isError && !isLoading && (
          <PageError
            message={t("common.genericError")}
            onRetry={() => refetch()}
          />
        )}

        {data && items.length === 0 && !isError && (
          <EmptyState
            icon={<Activity size={26} />}
            title={t("activityPage.emptyTitle")}
            hint={t("activityPage.emptyHint")}
          />
        )}

        {groups.length > 0 && (
          <div className={`activity-page__feed${dimmed ? " is-dimmed" : ""}`}>
            {groups.map((g) => (
              <section key={g.key}>
                <h2 className="activity-page__day">{g.label}</h2>
                {g.items.map((item) => (
                  <ActivityRow
                    key={`${item.user.id}-${item.movie.id}-${item.lastActivityAtUtc}`}
                    item={item}
                  />
                ))}
              </section>
            ))}
          </div>
        )}

        {isFetchNextPageError && (
          <p className="activity-page__error">{t("common.genericError")}</p>
        )}

        {hasNextPage && (
          <div className="activity-page__more">
            <button
              type="button"
              className="btn-secondary"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage
                ? t("profile.loadingMore")
                : t("activityPage.loadMore")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
