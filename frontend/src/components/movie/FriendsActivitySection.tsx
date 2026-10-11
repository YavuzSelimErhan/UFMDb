import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Film,
  Heart,
  HeartCrack,
  MessageSquare,
  Star,
  Ticket,
  UserPlus,
} from "lucide-react";
import { feedService } from "@/services";
import { useAppSelector } from "@/store";
import PersonAvatar from "@/components/common/PersonAvatar";
import type { FriendActivity, FriendActivityUser } from "@/types";
import "./FriendsActivitySection.css";

/* ---------- yardımcılar ---------- */

/** Bağımlılıksız göreli zaman (NotificationBell'dekiyle aynı mantık). */
function timeAgo(iso: string, locale: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffMin < 1) return rtf.format(0, "minute");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return rtf.format(-diffDay, "day");
  return rtf.format(-Math.round(diffDay / 30), "month");
}

const displayName = (u: FriendActivityUser) => u.fullName || u.userName;

/** "Ne yaptı?" cümlesi: puan > izleme > tepki > yorum önceliğiyle. */
function getVerb(a: FriendActivity, spotlight: boolean, t: TFunction): string {
  if (spotlight && a.hasReview) {
    return a.rating != null
      ? t("friendsActivity.verbRatedAndReviewed")
      : t("friendsActivity.verbReviewed");
  }
  if (a.rating != null) return t("friendsActivity.verbRated");
  if (a.watched) return t("friendsActivity.verbWatched");
  if (a.reaction === "Like") return t("friendsActivity.verbLiked");
  if (a.reaction === "Dislike") return t("friendsActivity.verbDisliked");
  return t("friendsActivity.verbReviewed");
}

/** Fiil zaten tepkiyi anlatıyorsa ikinci satırda tekrar etmeyiz. */
const verbCoversReaction = (a: FriendActivity) =>
  a.rating == null && !a.watched && a.reaction != null;

/* ---------- küçük parçalar ---------- */

function Stars({ value }: { value: number }) {
  return (
    <span
      className="friends-activity__stars"
      role="img"
      aria-label={value.toFixed(1)}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="friends-activity__star">
            <Star size={15} className="friends-activity__star-base" />
            <span
              className="friends-activity__star-fill"
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

function Poster({ movie }: { movie: FriendActivity["movie"] }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !movie.posterUrl || failed;
  return (
    <Link to={`/movies/${movie.id}`} className="friends-activity__poster">
      {showFallback ? (
        <span className="friends-activity__poster-fallback">
          <Film size={22} />
          <span>{movie.title}</span>
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

function ActivityBadge({ a }: { a: FriendActivity }) {
  const { t } = useTranslation();
  let icon: ReactNode;
  let label: string;
  let modifier = "";

  if (a.reaction === "Dislike") {
    icon = <HeartCrack size={13} />;
    label = t("friendsActivity.reactionDislike");
    modifier = " is-dislike";
  } else if (a.reaction === "Like") {
    icon = <Heart size={13} fill="currentColor" />;
    label = t("friendsActivity.reactionLike");
    modifier = " is-like";
  } else if (a.rating != null) {
    icon = <Star size={13} />;
    label = t("friendsActivity.verbRated");
  } else if (a.watched) {
    icon = <Ticket size={13} />;
    label = t("friendsActivity.verbWatched");
  } else {
    icon = <MessageSquare size={13} />;
    label = t("friendsActivity.verbReviewed");
  }

  return (
    <span
      className={`friends-activity__badge${modifier}`}
      title={label}
      role="img"
      aria-label={label}
    >
      {icon}
    </span>
  );
}

/* ---------- sağdaki küçük kart ---------- */

function ActivityCard({ a }: { a: FriendActivity }) {
  const { t, i18n } = useTranslation();
  const name = displayName(a.user);

  const meta: string[] = [];
  if (a.rating != null) meta.push(`★ ${a.rating.toFixed(1)}`);
  if (a.reaction && !verbCoversReaction(a)) {
    meta.push(
      a.reaction === "Dislike"
        ? t("friendsActivity.reactionDislike")
        : t("friendsActivity.reactionLike"),
    );
  }
  meta.push(timeAgo(a.lastActivityAtUtc, i18n.language));

  return (
    <article className="friends-activity__card">
      <div className="friends-activity__poster-wrap">
        <Poster movie={a.movie} />
        <ActivityBadge a={a} />
        <Link
          to={`/users/${a.user.userName}`}
          className="friends-activity__card-avatar"
          aria-label={name}
        >
          <PersonAvatar
            id={a.user.id}
            photoUrl={a.user.avatarUrl}
            fullName={name}
            size="sm"
          />
        </Link>
      </div>
      <div className="friends-activity__caption">
        <h3 className="friends-activity__card-title">
          <Link to={`/movies/${a.movie.id}`}>{a.movie.title}</Link>
        </h3>
        <p className="friends-activity__card-who">
          <Link to={`/users/${a.user.userName}`}>{name}</Link>{" "}
          {getVerb(a, false, t)}
        </p>
        <p className="friends-activity__card-meta">{meta.join(" · ")}</p>
      </div>
    </article>
  );
}

/* ---------- soldaki büyük kart ---------- */

function Spotlight({ a }: { a: FriendActivity }) {
  const { t, i18n } = useTranslation();
  const name = displayName(a.user);
  const movieMeta = [
    a.movie.releaseYear > 0 ? a.movie.releaseYear : null,
    a.movie.genre,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="friends-activity__spot">
      <div className="friends-activity__spot-top">
        <Link
          to={`/users/${a.user.userName}`}
          className="friends-activity__spot-avatar"
          aria-label={name}
        >
          <PersonAvatar
            id={a.user.id}
            photoUrl={a.user.avatarUrl}
            fullName={name}
            size="md"
          />
        </Link>
        <p className="friends-activity__who">
          <Link to={`/users/${a.user.userName}`}>{name}</Link>{" "}
          {getVerb(a, true, t)}
        </p>
        <time className="friends-activity__time" dateTime={a.lastActivityAtUtc}>
          {timeAgo(a.lastActivityAtUtc, i18n.language)}
        </time>
      </div>

      <div className="friends-activity__spot-body">
        <Poster movie={a.movie} />
        <div className="friends-activity__spot-info">
          <h3 className="friends-activity__movie-title">
            <Link to={`/movies/${a.movie.id}`}>{a.movie.title}</Link>
          </h3>
          {movieMeta && (
            <p className="friends-activity__movie-meta">{movieMeta}</p>
          )}

          {a.rating != null && (
            <div className="friends-activity__rating">
              <Stars value={a.rating} />
              <span>{a.rating.toFixed(1)}</span>
            </div>
          )}

          {a.reviewExcerpt && (
            <blockquote className="friends-activity__quote">
              {a.reviewExcerpt}
            </blockquote>
          )}
          {a.containsSpoiler && !a.reviewExcerpt && (
            <p className="friends-activity__spoiler">
              {t("friendsActivity.spoilerHidden")}
            </p>
          )}

          {(a.reaction || a.watched) && (
            <div className="friends-activity__chips">
              {a.reaction === "Like" && (
                <span className="friends-activity__chip">
                  <Heart size={13} fill="currentColor" />
                  {t("friendsActivity.reactionLike")}
                </span>
              )}
              {a.reaction === "Dislike" && (
                <span className="friends-activity__chip friends-activity__chip--dislike">
                  <HeartCrack size={13} />
                  {t("friendsActivity.reactionDislike")}
                </span>
              )}
              {a.watched && (
                <span className="friends-activity__chip">
                  <Ticket size={13} />
                  {t("friendsActivity.watched")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="friends-activity__spot-footer">
        <Link to={`/movies/${a.movie.id}`} className="btn-primary">
          {t("friendsActivity.goToMovie")}
        </Link>
      </div>
    </article>
  );
}

/* ---------- ana bölüm ---------- */

export default function FriendsActivitySection() {
  const { t } = useTranslation();
  const { isAuthenticated, isSessionChecked } = useAppSelector((s) => s.auth);
  const enabled = isAuthenticated && isSessionChecked;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["friends-activity"],
    queryFn: feedService.getFriendsActivity,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });

  // Misafir ya da hata: bölüm hiç görünmez, ana sayfanın geri kalanı etkilenmez.
  if (!enabled || isError) return null;

  if (isLoading || !data) {
    return (
      <section className="friends-activity" aria-busy="true">
        <div className="friends-activity__skeleton" />
      </section>
    );
  }

  const {
    followingCount,
    weeklyActiveFriendCount,
    weeklyActivityCount,
    spotlight,
    items,
  } = data;

  const header = (stack?: ReactNode) => (
    <div className="friends-activity__header">
      <div>
        <p className="friends-activity__eyebrow">
          {t("friendsActivity.eyebrow")}
        </p>
        <h2 className="friends-activity__title">
          {t("friendsActivity.title")}
        </h2>
      </div>
      {stack}
    </div>
  );

  // Kimseyi takip etmiyor: davet kartı.
  if (followingCount === 0) {
    return (
      <section className="friends-activity">
        {header()}
        <div className="friends-activity__find">
          <div className="friends-activity__find-text">
            <UserPlus size={22} aria-hidden="true" />
            <h3>{t("friendsActivity.findTitle")}</h3>
            <p>{t("friendsActivity.findText")}</p>
            <Link to="/users" className="btn-primary">
              {t("friendsActivity.findCta")}
            </Link>
          </div>
          <div className="friends-activity__find-ghosts" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    );
  }

  // Takip ediyor ama son 7 günde hareket yok: bölüm gizlenir.
  if (!spotlight && items.length === 0) return null;

  const people = new Map<string, FriendActivityUser>();
  [spotlight, ...items].forEach((a) => {
    if (a) people.set(a.user.id, a.user);
  });
  const shown = Array.from(people.values());
  const extra = Math.max(0, weeklyActiveFriendCount - shown.length);

  const stack = (
    <div className="friends-activity__active">
      <div className="friends-activity__stack">
        {shown.map((u) => (
          <PersonAvatar
            key={u.id}
            id={u.id}
            photoUrl={u.avatarUrl}
            fullName={displayName(u)}
            size="sm"
          />
        ))}
        {extra > 0 && (
          <span className="friends-activity__more-chip">+{extra}</span>
        )}
      </div>
      <p>
        {t("friendsActivity.activeThisWeek", { n: weeklyActiveFriendCount })}
      </p>
    </div>
  );

  return (
    <section className="friends-activity">
      {header(stack)}

      <div
        className={`friends-activity__grid${spotlight ? "" : " friends-activity__grid--rail-only"}`}
      >
        {spotlight && <Spotlight a={spotlight} />}
        <div className="friends-activity__rail">
          {items.map((a) => (
            <ActivityCard key={`${a.user.id}-${a.movie.id}`} a={a} />
          ))}
        </div>
      </div>

      <p className="friends-activity__footer">
        {t("friendsActivity.activityCount", { n: weeklyActivityCount })}
      </p>
    </section>
  );
}
