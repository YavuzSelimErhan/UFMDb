import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Eye,
  Heart,
  MessageSquare,
  Star,
  ThumbsDown,
  UserPlus,
} from "lucide-react";
import { feedService } from "@/services";
import { useAppSelector } from "@/store";
import PersonAvatar from "@/components/common/PersonAvatar";
import MoviePoster from "@/components/common/MoviePoster";
import { timeAgo } from "@/utils/timeAgo";
import type { FriendActivity, FriendActivityUser } from "@/types";
import "./FriendsActivitySection.css";

/** Başlık altındaki avatar yığınında en fazla bu kadar kişi. */
const MAX_STACK = 4;
/** Ana sayfada en fazla bu kadar kart; gerisi "Tümünü Gör" sayfasında. */
const MAX_CARDS = 8;

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

/** Ana eylem puan/yorum olsa bile kullanıcının tepkisi ikinci rozet olarak gösterilir. */
function getReactionKind(a: FriendActivity): "like" | "dislike" | null {
  if (a.reaction === "Like") return "like";
  if (a.reaction === "Dislike") return "dislike";
  return null;
}

const KIND_ICON: Record<Kind, ReactNode> = {
  review: <MessageSquare size={13} />,
  rated: <Star size={13} fill="currentColor" />,
  like: <Heart size={13} fill="currentColor" />,
  dislike: <ThumbsDown size={13} />,
  watched: <Eye size={13} />,
};

/* ---------- küçük parçalar ---------- */

/** ThemedMovieRail ile aynı başlık düzeni: solda başlık, sağda "Tümünü Gör". */
function SectionHeader({ sub, aside }: { sub?: ReactNode; aside?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="fa__header">
      <div className="fa__label-wrap">
        <p className="fa__eyebrow">{t("friendsActivity.eyebrow")}</p>
        <h2 className="fa__title">{t("friendsActivity.title")}</h2>
        {sub}
      </div>
      {aside}
    </div>
  );
}

/** 5 yıldız yan yana; 3.5 gibi değerlerde yıldız kısmen dolar. */
function StarRow({ value }: { value: number }) {
  return (
    <span
      className="fa__stars"
      role="img"
      aria-label={`${value.toFixed(1)} / 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="fa__star" aria-hidden="true">
            <Star size={14} className="fa__star-base" />
            <span className="fa__star-fill" style={{ width: `${fill * 100}%` }}>
              <Star size={14} fill="currentColor" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Spoiler'lı yorum: bulanık, tıklayınca açılır. */
function SpoilerText({ text }: { text: string }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  return (
    <>
      <span className="fa__spoiler-badge">{t("movie.containsSpoiler")}</span>
      <button
        type="button"
        className="fa__quote-btn"
        onClick={() => setShown(true)}
        aria-label={shown ? undefined : t("reviews.revealSpoiler")}
        disabled={shown}
      >
        <span className={`fa__quote${shown ? "" : " is-blurred"}`}>{text}</span>
      </button>
    </>
  );
}

/** Gerçek yerleşimle aynı iskelet: yüklenince sayfa kaymasın. */
function Skeleton() {
  return (
    <section className="fa" aria-busy="true">
      <SectionHeader />
      <div className="fa__grid" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="fa__sk fa__sk-card" />
        ))}
      </div>
    </section>
  );
}

/* ---------- aktivite kartı ---------- */

function ActivityCard({ a, index }: { a: FriendActivity; index: number }) {
  const { t, i18n } = useTranslation();
  const name = displayName(a.user);
  const kind = getKind(a);
  const wide = kind === "review" && !!a.reviewExcerpt;

  const reactionKind = getReactionKind(a);
  const secondaryBadge =
    reactionKind && reactionKind !== kind ? reactionKind : null;

  const verb = {
    review: t("friendsActivity.verbReviewed"),
    rated: t("friendsActivity.verbRated"),
    like: t("friendsActivity.reactionLike"),
    dislike: t("friendsActivity.reactionDislike"),
    watched: t("friendsActivity.verbWatched"),
  }[kind];

  return (
    <article
      className={`fa__tile fa__tile--${kind}${wide ? " fa__tile--wide" : ""}`}
      style={{ "--i": index } as CSSProperties}
    >
      <div className="fa__poster-wrap">
        <MoviePoster
          movie={a.movie}
          className="fa__poster"
          fallback="title"
          iconSize={22}
        />

        {/* Eylem metni alt yazıda ("Ayşe puanladı"); rozetler sadece görsel ipucu. */}
        <div className="fa__badges" aria-hidden="true">
          {secondaryBadge && (
            <span className={`fa__badge fa__badge--${secondaryBadge}`}>
              {KIND_ICON[secondaryBadge]}
            </span>
          )}
          <span className="fa__badge">{KIND_ICON[kind]}</span>
        </div>

        {a.rating != null && (
          <div className="fa__rating">
            <StarRow value={a.rating} />
            <b>{a.rating.toFixed(1)}</b>
          </div>
        )}
      </div>

      <div className="fa__caption">
        {wide && (
          <div className="fa__quote-wrap">
            <span className="fa__quote-mark" aria-hidden="true">
              “
            </span>
            {a.containsSpoiler ? (
              <SpoilerText text={a.reviewExcerpt!} />
            ) : (
              <p className="fa__quote">{a.reviewExcerpt}</p>
            )}
          </div>
        )}

        <div className="fa__who-row">
          <Link
            to={`/users/${a.user.userName}`}
            className="fa__avatar"
            aria-label={name}
          >
            <PersonAvatar
              id={a.user.id}
              photoUrl={a.user.avatarUrl}
              fullName={name}
              size="sm"
            />
          </Link>
          <div className="fa__who">
            <p className="fa__line-who">
              <Link to={`/users/${a.user.userName}`} className="fa__user">
                {name}
              </Link>
              <span className="fa__verb">{verb}</span>
            </p>
            {/* Başlık linki kartın tamamını kaplar (stretched link). */}
            <h3 className="fa__movie-title">
              <Link to={`/movies/${a.movie.id}`}>{a.movie.title}</Link>
            </h3>
            <p className="fa__meta">
              {a.movie.releaseYear > 0 && (
                <>
                  <span>{a.movie.releaseYear}</span>
                  <span className="fa__sep" aria-hidden="true">
                    ·
                  </span>
                </>
              )}
              <time dateTime={a.lastActivityAtUtc}>
                {timeAgo(a.lastActivityAtUtc, i18n.language)}
              </time>
            </p>
          </div>
        </div>
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
  if (isLoading || !data) return <Skeleton />;

  const {
    followingCount,
    weeklyActiveFriendCount,
    weeklyActivityCount,
    spotlight,
    items,
  } = data;

  // Kimseyi takip etmiyor: davet.
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

  // Spotlight ayrı gösterilmiyor; tek akışta en başta yer alır.
  // Aynı kişi+film iki kez gelirse (spotlight ile items çakışması) tekilleştirilir.
  const seen = new Set<string>();
  const all = [spotlight, ...items]
    .filter((a): a is FriendActivity => {
      if (a == null) return false;
      const key = `${a.user.id}-${a.movie.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CARDS);

  // Takip ediyor ama son 7 günde hareket yok: bölüm gizlenir.
  if (all.length === 0) return null;

  const people = new Map<string, FriendActivityUser>();
  all.forEach((a) => people.set(a.user.id, a.user));
  const stack = Array.from(people.values()).slice(0, MAX_STACK);
  // Görünen kartlarda yer almayan ama bu hafta aktif olan arkadaşlar.
  const extra = Math.max(0, weeklyActiveFriendCount - stack.length);

  const sub = (
    <div className="fa__sub">
      <div className="fa__stack">
        {stack.map((u) => (
          <PersonAvatar
            key={u.id}
            id={u.id}
            photoUrl={u.avatarUrl}
            fullName={displayName(u)}
            size="sm"
          />
        ))}
        {extra > 0 && (
          <span className="fa__stack-more" aria-hidden="true">
            +{extra}
          </span>
        )}
      </div>
      <p>
        {t("friendsActivity.activeThisWeek", { n: weeklyActiveFriendCount })}
      </p>
    </div>
  );

  // ThemedMovieRail'in "Tümünü Gör" bağlantısıyla aynı sınıf ve metin.
  const seeAll = (
    <Link to="/activity" className="rail__see-all">
      {t("home.seeAll")} <ChevronRight size={14} />
    </Link>
  );

  return (
    <section className="fa">
      <SectionHeader sub={sub} aside={seeAll} />
      <div className="fa__perf" aria-hidden="true" />

      <div className="fa__grid">
        {all.map((a, i) => (
          <ActivityCard key={`${a.user.id}-${a.movie.id}`} a={a} index={i} />
        ))}
      </div>

      <div className="fa__footer">
        <span>
          {t("friendsActivity.activityCount", { n: weeklyActivityCount })}
        </span>
      </div>
    </section>
  );
}
