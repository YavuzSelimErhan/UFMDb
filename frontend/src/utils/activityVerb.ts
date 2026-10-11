import type { TFunction } from "i18next";
import type { ActivityFeedItem, FriendActivity, ReactionType } from "@/types";

/**
 * Ortak "ne yaptı" fiil sözlüğü, ActivityPage ve FriendsActivitySection arasında paylaşılır.
 * Tek kaynak bu: `ACTIVITY_VERB_KEYS` i18n anahtar tablosu her iki yerde de birebir aynıydı,
 * burada tekilleştirildi.
 *
 * ÖNEMLİ: iki sayfanın öncelik SIRASI gerçekten farklı, bu yüzden tek bir ortak "if zinciri"
 * kullanmak YANLIŞ olur (davranışı sessizce değiştirir). Bu yüzden iki ayrı internal
 * `...VerbKind` fonksiyonu var — her biri kendi sayfasının orijinal mantığını birebir
 * koruyor — ve sadece kind → i18n-key eşlemesi ile dışa açılan `get...Verb` sarmalayıcılar
 * paylaşılıyor.
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
 * sonra izleme > puan > tepki (dislike kontrolü önce). Hiçbiri yoksa varsayılan "liked"
 * (orijinal `getVerbKind` davranışı — reaction null olsa bile).
 */
function getActivityPageVerbKind(a: ActivityLike): ActivityVerbKind {
  if (a.hasReview) return a.rating != null ? "ratedAndReviewed" : "reviewed";
  if (a.watched) return a.rating != null ? "watchedAndRated" : "watched";
  if (a.rating != null) return "rated";
  if (a.reaction === "Dislike") return "disliked";
  return "liked";
}

/**
 * FriendsActivitySection: yorum sadece `spotlight` kartında önceliklidir (büyük kartta yorum
 * metni zaten ayrıca gösteriliyor). Rail kartlarında (`spotlight: false`) sıra puan > izleme >
 * tepki (like kontrolü önce); hiçbiri yoksa varsayılan "reviewed" (orijinal `getVerb` davranışı).
 */
function getFriendActivityVerbKind(
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
