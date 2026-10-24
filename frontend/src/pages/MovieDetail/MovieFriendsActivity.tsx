import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Heart,
  HeartCrack,
  PenLine,
} from "lucide-react";
import { movieService } from "@/services";
import { useAppSelector } from "@/store";
import type {
  FriendActivityUser,
  MovieFriendActivity,
  MovieFriendsActivity,
} from "@/types";
import "./MovieFriendsActivity.css";

/** Kullanıcı profil rotası (kullanıcı adına göre). Projedeki rota farklıysa burayı değiştir. */
const PROFILE_ROUTE_BASE = "/users/";

function timeAgo(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  return rtf.format(Math.round(months / 12), "year");
}

function Avatar({ user }: { user: FriendActivityUser }) {
  const initial = (user.fullName || user.userName)
    .trim()
    .charAt(0)
    .toUpperCase();
  return user.avatarUrl ? (
    <img className="ff-avatar" src={user.avatarUrl} alt="" loading="lazy" />
  ) : (
    <span className="ff-avatar ff-avatar--fallback" aria-hidden="true">
      {initial}
    </span>
  );
}

function Ticket({
  item,
  locale,
}: {
  item: MovieFriendActivity;
  locale: string;
}) {
  const { t } = useTranslation();
  const { user } = item;

  return (
    <Link
      to={`${PROFILE_ROUTE_BASE}${encodeURIComponent(user.userName)}`}
      className="ff-ticket"
    >
      <div className="ff-ticket__stub">
        <Avatar user={user} />
        <span className="ff-ticket__admit">ADMIT</span>
      </div>

      <div className="ff-ticket__body">
        <div className="ff-ticket__head">
          <span className="ff-ticket__name">
            {user.fullName || user.userName}
          </span>
          <span className="ff-ticket__when">
            {timeAgo(item.lastActivityAtUtc, locale)}
          </span>
        </div>

        <div className="ff-ticket__marks">
          {item.rating != null && (
            <span className="ff-ticket__rating">
              ★ {item.rating.toFixed(1)}
            </span>
          )}
          {item.reaction === "Like" && (
            <span
              className="ff-ticket__mark ff-ticket__mark--like"
              title={t("movie.liked")}
            >
              <Heart size={13} fill="currentColor" />
            </span>
          )}
          {item.reaction === "Dislike" && (
            <span
              className="ff-ticket__mark ff-ticket__mark--dislike"
              title={t("movie.notForMe")}
            >
              <HeartCrack size={13} />
            </span>
          )}
          {item.watched && item.rating == null && (
            <span className="ff-ticket__mark">
              <CheckCircle2 size={13} /> {t("movie.friends.watchedOnly")}
            </span>
          )}
        </div>

        {item.reviewExcerpt && (
          <p className="ff-ticket__excerpt">“{item.reviewExcerpt}”</p>
        )}
        {item.hasReview && !item.reviewExcerpt && (
          <p className="ff-ticket__note">
            {item.containsSpoiler ? (
              <>
                <AlertTriangle size={12} /> {t("movie.friends.spoilerReview")}
              </>
            ) : (
              <>
                <PenLine size={12} /> {t("movie.friends.hasReview")}
              </>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function MovieFriendsActivity({ movieId }: { movieId: string }) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const locale = i18n.language?.toLowerCase().startsWith("tr")
    ? "tr-TR"
    : "en-US";

  const { data } = useQuery({
    queryKey: ["movie-friends", movieId],
    queryFn: () => movieService.getFriendsActivity(movieId),
    enabled: isAuthenticated && !!movieId,
    staleTime: 60_000,
  });

  if (!isAuthenticated || !data || data.items.length === 0) return null;

  const remaining = data.totalCount - data.items.length;

  return (
    <section className="ff-section" aria-label={t("movie.friends.title")}>
      <div className="ff-heading">
        <span className="ff-heading__eyebrow">ADMIT {data.totalCount}</span>
        <h3 className="ff-heading__title">{t("movie.friends.title")}</h3>
      </div>
      <p className="ff-sub">
        {t("movie.friends.subtitle", { n: data.totalCount })}
      </p>

      <div className="ff-grid">
        {data.items.map((item) => (
          <Ticket key={item.user.id} item={item} locale={locale} />
        ))}
      </div>

      {remaining > 0 && (
        <p className="ff-more">{t("movie.friends.more", { n: remaining })}</p>
      )}
    </section>
  );
}
