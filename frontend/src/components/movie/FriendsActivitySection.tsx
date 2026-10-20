import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Star, UserPlus } from "lucide-react";
import { feedService } from "@/services";
import { useAppSelector } from "@/store";
import PersonAvatar from "@/components/common/PersonAvatar";
import MoviePoster from "@/components/common/MoviePoster";
import { timeAgo } from "@/utils/timeAgo";
import type { FriendActivity, FriendActivityUser } from "@/types";
import "./FriendsActivitySection.css";

const MAX_STRIP = 8;
const displayName = (u: FriendActivityUser) => u.fullName || u.userName;

type Kind = "review" | "rated" | "like" | "dislike" | "watched";

/** Kartın ana eylemi: yorum > puan > reaksiyon > izledi. */
function getKind(a: FriendActivity): Kind {
  if (a.reviewExcerpt || a.containsSpoiler) return "review";
  if (a.rating != null) return "rated";
  if (a.reaction === "Dislike") return "dislike";
  if (a.reaction === "Like") return "like";
  return "watched";
}

function SectionHeader({ aside }: { aside?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="fa__header">
      <div>
        <p className="fa__eyebrow">{t("friendsActivity.eyebrow")}</p>
        <h2 className="fa__title">{t("friendsActivity.title")}</h2>
      </div>
      {aside}
    </div>
  );
}

function SpoilerText({ text }: { text: string }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  return (
    <>
      <span className="fa__spoiler-badge">{t("movie.containsSpoiler")}</span>
      <button
        type="button"
        className={`fa__quote fa__quote-btn${shown ? "" : " is-blurred"}`}
        onClick={() => setShown(true)}
        aria-label={shown ? undefined : t("reviews.revealSpoiler")}
        disabled={shown}
      >
        {text}
      </button>
    </>
  );
}

function ActivityCard({ a }: { a: FriendActivity }) {
  const { t, i18n } = useTranslation();
  const name = displayName(a.user);
  const kind = getKind(a);

  const chipLabel = {
    review: t("friendsActivity.verbReviewed"),
    rated: t("friendsActivity.verbRated"),
    like: t("friendsActivity.reactionLike"),
    dislike: t("friendsActivity.reactionDislike"),
    watched: t("friendsActivity.verbWatched"),
  }[kind];

  const meta = [
    a.movie.releaseYear > 0 ? a.movie.releaseYear : null,
    a.movie.genre,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="fa__card">
      <div className="fa__card-top">
        <Link
          to={`/users/${a.user.userName}`}
          className="fa__card-avatar"
          aria-label={name}
        >
          <PersonAvatar
            id={a.user.id}
            photoUrl={a.user.avatarUrl}
            fullName={name}
            size="sm"
          />
        </Link>
        <div className="fa__card-who">
          <Link to={`/users/${a.user.userName}`}>{name}</Link>
          <time dateTime={a.lastActivityAtUtc}>
            {timeAgo(a.lastActivityAtUtc, i18n.language)}
          </time>
        </div>
        <span className={`fa__chip fa__chip--${kind}`}>{chipLabel}</span>
      </div>

      <div className="fa__card-body">
        <MoviePoster
          movie={a.movie}
          className="fa__poster"
          fallback="title"
          iconSize={20}
        />
        <div className="fa__card-info">
          <h3 className="fa__movie-title">
            {/* stretched link: kartın tamamı tıklanabilir */}
            <Link to={`/movies/${a.movie.id}`}>{a.movie.title}</Link>
          </h3>
          {meta && <p className="fa__movie-meta">{meta}</p>}

          {a.rating != null && (
            <div className="fa__rating">
              <Star size={13} fill="currentColor" />
              <span>{a.rating.toFixed(1)}</span>
            </div>
          )}

          {a.reviewExcerpt &&
            (a.containsSpoiler ? (
              <SpoilerText text={a.reviewExcerpt} />
            ) : (
              <p className="fa__quote">{a.reviewExcerpt}</p>
            ))}
        </div>
      </div>
    </article>
  );
}

function Skeleton() {
  return (
    <section className="fa" aria-busy="true">
      <SectionHeader />
      <div className="fa__strip" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="fa__sk fa__sk-avatar" />
        ))}
      </div>
      <div className="fa__grid" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="fa__sk fa__sk-card" />
        ))}
      </div>
    </section>
  );
}

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

  if (!enabled || isError) return null;
  if (isLoading || !data) return <Skeleton />;

  const { followingCount, weeklyActivityCount, spotlight, items } = data;

  if (followingCount === 0) {
    return (
      <section className="fa">
        <SectionHeader />
        <div className="fa__find">
          <UserPlus size={22} aria-hidden="true" />
          <h3>{t("friendsActivity.findTitle")}</h3>
          <p>{t("friendsActivity.findText")}</p>
          <Link to="/users" className="btn-primary">
            {t("friendsActivity.findCta")}
          </Link>
        </div>
      </section>
    );
  }

  const all = [spotlight, ...items].filter(
    (a): a is FriendActivity => a != null,
  );
  if (all.length === 0) return null;

  const people = new Map<string, FriendActivityUser>();
  all.forEach((a) => people.set(a.user.id, a.user));
  const strip = Array.from(people.values()).slice(0, MAX_STRIP);

  const seeAll = (
    <Link to="/activity" className="fa__see-all">
      {t("friendsActivity.seeAllActivity")} <ArrowRight size={13} />
    </Link>
  );

  return (
    <section className="fa">
      <SectionHeader
        aside={<span className="fa__see-all-desktop">{seeAll}</span>}
      />

      <div className="fa__strip">
        {strip.map((u) => (
          <Link key={u.id} to={`/users/${u.userName}`} className="fa__friend">
            <span className="fa__ring">
              <PersonAvatar
                id={u.id}
                photoUrl={u.avatarUrl}
                fullName={displayName(u)}
                size="md"
              />
            </span>
            <span className="fa__friend-name">{u.userName}</span>
          </Link>
        ))}
      </div>

      <div className="fa__grid">
        {all.map((a) => (
          <ActivityCard key={`${a.user.id}-${a.movie.id}`} a={a} />
        ))}
      </div>

      <div className="fa__footer">
        <span>
          {t("friendsActivity.activityCount", { n: weeklyActivityCount })}
        </span>
        <span className="fa__see-all-mobile">{seeAll}</span>
      </div>
    </section>
  );
}
