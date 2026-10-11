import type { MovieListItem, ReactionType } from "@/types";

/** currentUserReaction yoksa eski isLikedByCurrentUser bayrağına düşer. */
export const getReaction = (
  m: Partial<
    Pick<MovieListItem, "currentUserReaction" | "isLikedByCurrentUser">
  >,
): ReactionType | null =>
  m.currentUserReaction ?? (m.isLikedByCurrentUser ? "Like" : null);
