import type { TFunction } from "i18next";
import type { ActivityFeedItem, FriendActivity, ReactionType } from "@/types";

/**
 * Ortak "ne yaptı" fiil sözlüğü, ActivityPage ve FriendsActivitySection arasında paylaşılır.
 *
 * ÖNEMLİ: iki sayfanın öncelik SIRASI gerçekten farklı, bu yüzden tek bir ortak "if zinciri"
 * kullanmak davranışı sessizce değiştirir. İki ayrı `...VerbKind` fonksiyonu var; her biri
 * kendi sayfasının orijinal mantığını birebir korur. Sadece kind → i18n-key eşlemesi ve
 * "fiil neyi zaten söylüyor?" kuralı (aşağıda) paylaşılır.
 */
export type ActivityVerbKind =
  | "rated"
  | "watched"
  | "watchedAndRated"
  | "liked"
  | "disliked"
  | "reviewed"
  | "ratedAndReviewed";

interface ActivityLike {
  rating: number | null;
  watched: boolean;
  reaction: ReactionType | null;
  hasReview: boolean;
}

/**
 * ActivityPage satırı: yorum HER ZAMAN önceliklidir (puanla birlikteyse "ratedAndReviewed"),
 * sonra izleme > puan > tepki (dislike kontrolü önce). Hiçbiri yoksa varsayılan "liked".
 */
export function getActivityPageVerbKind(a: ActivityLike): ActivityVerbKind {
  if (a.hasReview) return a.rating != null ? "ratedAndReviewed" : "reviewed";
  if (a.watched) return a.rating != null ? "watchedAndRated" : "watched";
  if (a.rating != null) return "rated";
  if (a.reaction === "Dislike") return "disliked";
  return "liked";
}

/**
 * FriendsActivitySection: yorum sadece `spotlight` kartında önceliklidir. Rail kartlarında
 * (`spotlight: false`) sıra puan > izleme > tepki (like önce); hiçbiri yoksa "reviewed".
 */
export function getFriendActivityVerbKind(
  a: ActivityLike,
  spotlight: boolean,
): ActivityVerbKind {
  if (spotlight && a.hasReview) {
    return a.rating != null ? "ratedAndReviewed" : "reviewed";
  }
  if (a.rating != null) return "rated";
  if (a.watched) return "watched";
  if (a.reaction === "Like") return "liked";
  if (a.reaction === "Dislike") return "disliked";
  return "reviewed";
}

/**
 * Fiil zaten tepkiyi anlatıyorsa ("X beğenmedi") aynı bilgiyi çip/meta olarak tekrar etmeyiz.
 * Üç görünüm (spotlight, rail kartı, aktivite satırı) aynı kuralı buradan okur.
 */
export const verbCoversReaction = (kind: ActivityVerbKind): boolean =>
  kind === "liked" || kind === "disliked";

/** Fiil "izledi" diyorsa ayrıca "İzlendi" çipi göstermeyiz. */
export const verbCoversWatched = (kind: ActivityVerbKind): boolean =>
  kind === "watched" || kind === "watchedAndRated";

/** [başkası, sen] — "Elif puanladı" / "Sen puanladın" (Türkçede fiil çekimi değişiyor). */
const ACTIVITY_VERB_KEYS: Record<ActivityVerbKind, readonly [string, string]> =
  {
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

/** ActivityPage satırları için: `isCurrentUser` kişi zamirini belirler. */
export function getActivityVerb(item: ActivityFeedItem, t: TFunction): string {
  const kind = getActivityPageVerbKind(item);
  return t(ACTIVITY_VERB_KEYS[kind][item.isCurrentUser ? 1 : 0]);
}

/** FriendsActivitySection için: üçüncü kişi fiili kullanır (bu bölümde "Sen" satırı yok). */
export function getFriendActivityVerb(
  a: FriendActivity,
  spotlight: boolean,
  t: TFunction,
): string {
  const kind = getFriendActivityVerbKind(a, spotlight);
  return t(ACTIVITY_VERB_KEYS[kind][0]);
}
