import { useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Eye,
  Heart,
  HeartCrack,
  MessageSquare,
  Star,
  UserPlus,
} from "lucide-react";
import { feedService } from "@/services";
import { useAppSelector } from "@/store";
import PersonAvatar from "@/components/common/PersonAvatar";
import MoviePoster from "@/components/common/MoviePoster";
import { timeAgo } from "@/utils/timeAgo";
import type { FriendActivity, FriendActivityUser } from "@/types";
import "./FriendsActivitySection.css";

/** Rail içinde en fazla bu kadar kart; fazlası yatay kaydırılır. */
const MAX_CARDS = 10;
/** Bu süreden yeni aktivitenin avatarında küçük "yeni" noktası görünür. */
const FRESH_MS = 24 * 60 * 60 * 1000;

/** Yıldız boyutu (px). */
const STAR_SIZE = 16;

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

/** Ana eylem puan/yorum olsa bile kullanıcının tepkisi poster köşesinde rozet olur. */
function getReactionKind(a: FriendActivity): "like" | "dislike" | null {
  if (a.reaction === "Like") return "like";
  if (a.reaction === "Dislike") return "dislike";
  return null;
}

const KIND_ICON: Record<Kind, ReactNode> = {
  review: <MessageSquare size={13} />,
  rated: <Star size={13} fill="currentColor" />,
  like: <Heart size={13} fill="currentColor" />,
  dislike: <HeartCrack size={13} />,
  watched: <Eye size={13} />,
};

const byNewest = (x: FriendActivity, y: FriendActivity) =>
  Date.parse(y.lastActivityAtUtc) - Date.parse(x.lastActivityAtUtc);

/**
 * Her arkadaştan önce en son aktivite seçilir (çeşitlilik); yer kalırsa
 * kalan en yeni aktivitelerle MAX_CARDS'a tamamlanır. Sonuç en yeniden eskiye sıralı.
 */
function pickCards(list: FriendActivity[]): FriendActivity[] {
  const sorted = [...list].sort(byNewest);
  const users = new Set<string>();
  const firstPerUser: FriendActivity[] = [];
  const rest: FriendActivity[] = [];
  for (const a of sorted) {
    if (users.has(a.user.id)) {
      rest.push(a);
    } else {
      users.add(a.user.id);
      firstPerUser.push(a);
    }
  }
  return [...firstPerUser, ...rest].slice(0, MAX_CARDS).sort(byNewest);
}

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

/** Yatay kaydırma + fareyle sürükleme (ThemedMovieRail ile aynı davranış). */
function Track({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ isDown: false, startX: 0, startScroll: 0 });

  const onMouseDown = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    drag.current = {
      isDown: true,
      startX: e.pageX - el.offsetLeft,
      startScroll: el.scrollLeft,
    };
  };
  const onMouseMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el || !drag.current.isDown) return;
    e.preventDefault();
    el.scrollLeft =
      drag.current.startScroll -
      (e.pageX - el.offsetLeft - drag.current.startX);
  };
  const endDrag = () => {
    drag.current.isDown = false;
  };

  return (
    <div
      className="fa__track"
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      {children}
    </div>
  );
}

/** Yalnızca kazanılan yıldızlar gösterilir (boş yıldız yok); son yıldız kesirliyse kırpılır. */
function Stars({ value }: { value: number }) {
  const count = Math.max(1, Math.ceil(value));
  return (
    <span
      className="fa__stars"
      role="img"
      aria-label={`${value.toFixed(1)} / 5`}
    >
      {Array.from({ length: count }, (_, i) => {
        const fill = Math.min(1, value - i);
        return fill >= 1 ? (
          <Star
            key={i}
            size={STAR_SIZE}
            fill="currentColor"
            aria-hidden="true"
          />
        ) : (
          <span
            key={i}
            className="fa__star-part"
            style={{ width: `${fill * STAR_SIZE}px` }}
          >
            <Star size={STAR_SIZE} fill="currentColor" aria-hidden="true" />
          </span>
        );
      })}
      <span className="fa__stars-value">{value.toFixed(1)}</span>
    </span>
  );
}

/** Spoiler'lı yorum: bulanık, tıklayınca açılır. */
function SpoilerText({ text }: { text: string }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  return (
    <div className="fa__quote">
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
    </div>
  );
}

/** Gerçek yerleşimle aynı iskelet: yüklenince sayfa kaymasın. */
function Skeleton() {
  return (
    <section className="fa" aria-busy="true">
      <SectionHeader />
      <div className="fa__track" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="fa__sk fa__sk-card" />
        ))}
      </div>
    </section>
  );
}

/* ---------- aktivite kartı ---------- */

function ActivityCard({ a }: { a: FriendActivity }) {
  const { t, i18n } = useTranslation();
  const name = displayName(a.user);
  const kind = getKind(a);

  const reactionKind = getReactionKind(a);
  // Ana eylem zaten tepkiyse poster rozeti gösterilmez.
  const badge = reactionKind && reactionKind !== kind ? reactionKind : null;
  const fresh = Date.now() - Date.parse(a.lastActivityAtUtc) < FRESH_MS;

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
        {badge && (
          <span className={`fa__badge fa__badge--${badge}`} aria-hidden="true">
            {KIND_ICON[badge]}
          </span>
        )}
      </div>

      <div className="fa__info">
        {/* Kişi önce: avatar posterin alt kenarına taşar. */}
        <Link to={`/users/${a.user.userName}`} className="fa__who">
          <span className="fa__avatar">
            <PersonAvatar
              id={a.user.id}
              photoUrl={a.user.avatarUrl}
              fullName={name}
              size="sm"
            />
          </span>
          <span className="fa__user">{name}</span>
          <time
            className={`fa__time${fresh ? " is-fresh" : ""}`}
            dateTime={a.lastActivityAtUtc}
          >
            {timeAgo(a.lastActivityAtUtc, i18n.language)}
          </time>
        </Link>

        {/* Başlık linki kartın tamamını kaplar (stretched link). */}
        <h3 className="fa__title-row">
          <Link to={`/movies/${a.movie.id}`}>{a.movie.title}</Link>
          {a.movie.releaseYear > 0 && (
            <span className="fa__year">{a.movie.releaseYear}</span>
          )}
        </h3>

        {/* Eylem: puan varsa yıldızlar, değilse ikon + fiil. Yorum + puan ikisini de gösterir. */}
        <div className="fa__action">
          {kind !== "rated" && (
            <span className="fa__verb">
              {KIND_ICON[kind]}
              <span className="fa__verb-label">{verb}</span>
            </span>
          )}
          {a.rating != null && <Stars value={a.rating} />}
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

  const { followingCount, weeklyActivityCount, spotlight, items } = data;

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
  const unique = [spotlight, ...items].filter((a): a is FriendActivity => {
    if (a == null) return false;
    const key = `${a.user.id}-${a.movie.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const all = pickCards(unique);

  // Takip ediyor ama son 7 günde hareket yok: bölüm gizlenir.
  if (all.length === 0) return null;

  const seeAll = (
    <Link to="/activity" className="fa__see-all">
      {t("home.seeAll")} <ChevronRight size={14} />
    </Link>
  );

  return (
    <section className="fa">
      <SectionHeader aside={seeAll} />

      <Track>
        {all.map((a) => (
          <ActivityCard key={`${a.user.id}-${a.movie.id}`} a={a} />
        ))}
      </Track>

      <p className="fa__summary">
        {t("friendsActivity.activityCount", { n: weeklyActivityCount })}
      </p>
    </section>
  );
}
