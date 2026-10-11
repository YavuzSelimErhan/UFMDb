import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
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
import StarDisplay from "@/components/common/StarDisplay";
import MoviePoster from "@/components/common/MoviePoster";
import {
  getFriendActivityVerb,
  getFriendActivityVerbKind,
  verbCoversReaction,
  verbCoversWatched,
} from "@/utils/activityVerb";
import { timeAgo } from "@/utils/timeAgo";
import type { FriendActivity, FriendActivityUser } from "@/types";
import "./FriendsActivitySection.css";

/** Başlıktaki avatar yığınında en fazla bu kadar kişi; kalanı "+N". */
const MAX_STACK = 5;

const displayName = (u: FriendActivityUser) => u.fullName || u.userName;

/* ---------- küçük parçalar ---------- */

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

function SectionHeader({ aside }: { aside?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="friends-activity__header">
      <div>
        <p className="friends-activity__eyebrow">
          {t("friendsActivity.eyebrow")}
        </p>
        <h2 className="friends-activity__title">
          {t("friendsActivity.title")}
        </h2>
      </div>
      {aside}
    </div>
  );
}

/** Gerçek yerleşimle aynı iskelet: yüklenince sayfa kaymasın. */
function LoadingSkeleton() {
  return (
    <section className="friends-activity" aria-busy="true">
      <SectionHeader />
      <div className="friends-activity__grid" aria-hidden="true">
        <div className="friends-activity__sk friends-activity__sk-spot" />
        <div className="friends-activity__rail">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="friends-activity__sk-card">
              <div className="friends-activity__sk friends-activity__sk-poster" />
              <div className="friends-activity__sk friends-activity__sk-line" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- sağdaki küçük kart ---------- */

function ActivityCard({ a }: { a: FriendActivity }) {
  const { t, i18n } = useTranslation();
  const name = displayName(a.user);
  const kind = getFriendActivityVerbKind(a, false);

  const meta: string[] = [];
  if (a.rating != null) meta.push(`★ ${a.rating.toFixed(1)}`);
  if (a.reaction && !verbCoversReaction(kind)) {
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
        <MoviePoster
          movie={a.movie}
          className="friends-activity__poster"
          fallback="title"
          iconSize={22}
        />
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
        {/* Başlık linki kartın tamamını kaplar (stretched link). */}
        <h3 className="friends-activity__card-title">
          <Link to={`/movies/${a.movie.id}`}>{a.movie.title}</Link>
        </h3>
        <p className="friends-activity__card-who">
          <Link to={`/users/${a.user.userName}`}>{name}</Link>{" "}
          {getFriendActivityVerb(a, false, t)}
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
  const kind = getFriendActivityVerbKind(a, true);
  const showReaction = a.reaction != null && !verbCoversReaction(kind);
  const showWatched = a.watched && !verbCoversWatched(kind);

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
          {getFriendActivityVerb(a, true, t)}
        </p>
        <time className="friends-activity__time" dateTime={a.lastActivityAtUtc}>
          {timeAgo(a.lastActivityAtUtc, i18n.language)}
        </time>
      </div>

      <div className="friends-activity__spot-body">
        <MoviePoster
          movie={a.movie}
          className="friends-activity__poster"
          fallback="title"
          iconSize={22}
        />
        <div className="friends-activity__spot-info">
          {/* Başlık linki kartın tamamını kaplar (stretched link). */}
          <h3 className="friends-activity__movie-title">
            <Link to={`/movies/${a.movie.id}`}>{a.movie.title}</Link>
          </h3>
          {movieMeta && (
            <p className="friends-activity__movie-meta">{movieMeta}</p>
          )}

          {a.rating != null && (
            <div className="friends-activity__rating">
              <StarDisplay value={a.rating} />
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

          {(showReaction || showWatched) && (
            <div className="friends-activity__chips">
              {showReaction && a.reaction === "Like" && (
                <span className="friends-activity__chip friends-activity__chip--like">
                  <Heart size={13} fill="currentColor" />
                  {t("friendsActivity.reactionLike")}
                </span>
              )}
              {showReaction && a.reaction === "Dislike" && (
                <span className="friends-activity__chip friends-activity__chip--dislike">
                  <HeartCrack size={13} />
                  {t("friendsActivity.reactionDislike")}
                </span>
              )}
              {showWatched && (
                <span className="friends-activity__chip">
                  <Ticket size={13} />
                  {t("friendsActivity.watched")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Kartın tamamı zaten tıklanabilir; bu yalnızca görsel ipucu (tekrar eden link/odak durağı değil). */}
      <div className="friends-activity__spot-footer">
        <span className="friends-activity__spot-cta" aria-hidden="true">
          {t("friendsActivity.goToMovie")}
        </span>
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

  if (isLoading || !data) return <LoadingSkeleton />;

  const {
    followingCount,
    weeklyActiveFriendCount,
    weeklyActivityCount,
    spotlight,
    items,
  } = data;

  // Kimseyi takip etmiyor: davet kartı.
  if (followingCount === 0) {
    return (
      <section className="friends-activity">
        <SectionHeader />
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
  const shown = Array.from(people.values()).slice(0, MAX_STACK);
  const extra = Math.max(0, weeklyActiveFriendCount - shown.length);

  // "Tümünü gör" yalnızca altbilgide; başlıkta ikinci kopya yok.
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
      <SectionHeader aside={stack} />

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

      <div className="friends-activity__footer">
        <span>
          {t("friendsActivity.activityCount", { n: weeklyActivityCount })}
        </span>
        <Link to="/activity" className="friends-activity__see-all">
          {t("friendsActivity.seeAllActivity")}
        </Link>
      </div>
    </section>
  );
}
