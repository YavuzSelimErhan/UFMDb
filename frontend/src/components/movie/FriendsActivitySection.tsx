import { useState } from "react";
import type { ReactNode } from "react";
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

/** Ana sayfada en fazla bu kadar kart (mobilde CSS ilk 4'ü gösterir). */
const MAX_CARDS = 6;
/** Bu süreden yeni aktivitesi olan arkadaşın avatarı halkalı görünür. */
const FRESH_MS = 24 * 60 * 60 * 1000;
/** Şerit, en az bu kadar kişi (ya da ekstra arkadaş) varsa gösterilir; az kişide boş durur. */
const MIN_STRIP_PEOPLE = 3;

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

/** Ana eylem puan/yorum olsa bile kullanıcının tepkisi ayrı bir ikon olarak gösterilir. */
function getReactionKind(a: FriendActivity): "like" | "dislike" | null {
  if (a.reaction === "Like") return "like";
  if (a.reaction === "Dislike") return "dislike";
  return null;
}

const KIND_ICON: Record<Kind, ReactNode> = {
  review: <MessageSquare size={12} />,
  rated: <Star size={12} fill="currentColor" />,
  like: <Heart size={12} fill="currentColor" />,
  dislike: <ThumbsDown size={12} />,
  watched: <Eye size={12} />,
};

/* ---------- küçük parçalar ---------- */

/** ThemedMovieRail ile aynı başlık düzeni: solda başlık, sağda "Tümünü Gör". */
function SectionHeader({ aside }: { aside?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="fa__header">
      <div className="fa__label-wrap">
        <p className="fa__eyebrow">{t("friendsActivity.eyebrow")}</p>
        <h2 className="fa__title">{t("friendsActivity.title")}</h2>
      </div>
      {aside}
    </div>
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
        className="fa__snippet-btn"
        onClick={() => setShown(true)}
        aria-label={shown ? undefined : t("reviews.revealSpoiler")}
        disabled={shown}
      >
        <span className={`fa__snippet${shown ? "" : " is-blurred"}`}>
          {text}
        </span>
      </button>
    </>
  );
}

/** Gerçek yerleşimle aynı iskelet: yüklenince sayfa kaymasın. */
function Skeleton() {
  return (
    <section className="fa" aria-busy="true">
      <SectionHeader />
      <div className="fa__strip" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="fa__sk fa__sk-friend" />
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

/* ---------- arkadaş şeridi ---------- */

function FriendStrip({
  people,
  extra,
}: {
  people: { user: FriendActivityUser; fresh: boolean }[];
  extra: number;
}) {
  return (
    <div className="fa__strip">
      {people.map(({ user, fresh }) => (
        <Link
          key={user.id}
          to={`/users/${user.userName}`}
          className="fa__friend"
        >
          <span className={`fa__ring${fresh ? " is-new" : ""}`}>
            <PersonAvatar
              id={user.id}
              photoUrl={user.avatarUrl}
              fullName={displayName(user)}
              size="sm"
            />
            {fresh && <span className="fa__dot" aria-hidden="true" />}
          </span>
          <span className="fa__friend-name">{displayName(user)}</span>
        </Link>
      ))}
      {extra > 0 && (
        <Link to="/activity" className="fa__friend" aria-label={`+${extra}`}>
          <span className="fa__friend-more">+{extra}</span>
        </Link>
      )}
    </div>
  );
}

/* ---------- aktivite kartı ---------- */

function ActivityCard({ a }: { a: FriendActivity }) {
  const { t, i18n } = useTranslation();
  const name = displayName(a.user);
  const kind = getKind(a);

  const reactionKind = getReactionKind(a);
  // Ana eylem zaten tepkiyse ikinci ikon gösterilmez.
  const secondaryReaction =
    reactionKind && reactionKind !== kind ? reactionKind : null;
  // Ana eylem puan değilse (yorum + puan) puan ayrı çip olarak eklenir.
  const extraRating = kind !== "rated" && a.rating != null ? a.rating : null;

  const verb = {
    review: t("friendsActivity.verbReviewed"),
    rated: t("friendsActivity.verbRated"),
    like: t("friendsActivity.reactionLike"),
    dislike: t("friendsActivity.reactionDislike"),
    watched: t("friendsActivity.verbWatched"),
  }[kind];

  return (
    <article className={`fa__card fa__card--${kind}`}>
      <div className="fa__poster-wrap">
        <MoviePoster
          movie={a.movie}
          className="fa__poster"
          fallback="title"
          iconSize={20}
        />
      </div>

      <div className="fa__body">
        <div className="fa__top">
          <Link to={`/users/${a.user.userName}`} className="fa__who">
            <PersonAvatar
              id={a.user.id}
              photoUrl={a.user.avatarUrl}
              fullName={name}
              size="sm"
            />
            <span className="fa__user">{name}</span>
          </Link>
          <time className="fa__time" dateTime={a.lastActivityAtUtc}>
            {timeAgo(a.lastActivityAtUtc, i18n.language)}
          </time>
        </div>

        {/* Başlık linki kartın tamamını kaplar (stretched link). */}
        <h3 className="fa__title-row">
          <Link to={`/movies/${a.movie.id}`}>{a.movie.title}</Link>
          {a.movie.releaseYear > 0 && (
            <span className="fa__year">{a.movie.releaseYear}</span>
          )}
        </h3>

        <div className="fa__chips">
          <span
            className={`fa__chip${
              kind === "rated" ? " fa__chip--has-rating" : ""
            }`}
          >
            {KIND_ICON[kind]}
            <span className="fa__chip-label">{verb}</span>
            {kind === "rated" && a.rating != null && (
              <span className="fa__chip-rating">{a.rating.toFixed(1)}</span>
            )}
          </span>
          {extraRating != null && (
            <span
              className="fa__chip fa__chip--rating"
              role="img"
              aria-label={`${extraRating.toFixed(1)} / 5`}
            >
              <Star size={11} fill="currentColor" aria-hidden="true" />
              {extraRating.toFixed(1)}
            </span>
          )}
          {secondaryReaction && (
            <span
              className={`fa__chip fa__chip--${secondaryReaction}`}
              aria-hidden="true"
            >
              {KIND_ICON[secondaryReaction]}
            </span>
          )}
        </div>

        {a.reviewExcerpt &&
          (a.containsSpoiler ? (
            <SpoilerText text={a.reviewExcerpt} />
          ) : (
            <p className="fa__snippet">{a.reviewExcerpt}</p>
          ))}
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

  // Spotlight ayrı gösterilmiyor; tek akışta yer alır.
  // Aynı kişi+film iki kez gelirse tekilleştirilir.
  const seen = new Set<string>();
  const all = [spotlight, ...items]
    .filter((a): a is FriendActivity => {
      if (a == null) return false;
      const key = `${a.user.id}-${a.movie.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // En yeni en başta: spotlight eski bir aktiviteyse akışta sırayı bozmasın.
    .sort(
      (x, y) =>
        Date.parse(y.lastActivityAtUtc) - Date.parse(x.lastActivityAtUtc),
    )
    .slice(0, MAX_CARDS);

  // Takip ediyor ama son 7 günde hareket yok: bölüm gizlenir.
  if (all.length === 0) return null;

  // Şerit: görünen kartlardaki benzersiz kullanıcılar, ilk (en yeni) aktiviteye göre.
  const now = Date.now();
  const people = new Map<
    string,
    { user: FriendActivityUser; fresh: boolean }
  >();
  all.forEach((a) => {
    if (people.has(a.user.id)) return;
    const fresh = now - Date.parse(a.lastActivityAtUtc) < FRESH_MS;
    people.set(a.user.id, { user: a.user, fresh });
  });
  const strip = Array.from(people.values());
  // Kartlarda yer almayan ama bu hafta aktif olan arkadaşlar.
  const extra = Math.max(0, weeklyActiveFriendCount - strip.length);
  // Çok az kişi varsa şerit boş durur; kartlar zaten kullanıcıyı gösteriyor.
  const showStrip = strip.length >= MIN_STRIP_PEOPLE || extra > 0;

  // ThemedMovieRail'in "Tümünü Gör" bağlantısıyla aynı sınıf ve metin.
  const seeAll = (
    <Link to="/activity" className="rail__see-all">
      {t("home.seeAll")} <ChevronRight size={14} />
    </Link>
  );

  return (
    <section className="fa">
      <SectionHeader aside={seeAll} />
      {showStrip && <FriendStrip people={strip} extra={extra} />}

      <div className="fa__grid">
        {all.map((a) => (
          <ActivityCard key={`${a.user.id}-${a.movie.id}`} a={a} />
        ))}
      </div>

      {/* Mobilde yalnızca ilk 4 kart görünür; devamı için. */}
      <Link to="/activity" className="fa__more">
        {t("home.seeAll")}
      </Link>

      <div className="fa__footer">
        <span>
          {t("friendsActivity.activityCount", { n: weeklyActivityCount })}
        </span>
      </div>
    </section>
  );
}
