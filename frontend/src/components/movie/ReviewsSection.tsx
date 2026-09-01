import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Heart, User, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { movieService } from "@/services";
import { useAppSelector } from "@/store";
import type { MovieReview, ReviewSortBy } from "@/types";
import "./ReviewsSection.css";

interface ReviewsSectionProps {
  movieId: string;
  isAuthenticated: boolean;
}

const SORT_OPTIONS: { value: ReviewSortBy; labelKey: string }[] = [
  { value: "popular", labelKey: "reviews.sortPopular" },
  { value: "newest", labelKey: "reviews.sortNewest" },
  { value: "oldest", labelKey: "reviews.sortOldest" },
];

const PAGE_SIZE = 10;

export default function ReviewsSection({
  movieId,
  isAuthenticated,
}: ReviewsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { userId: currentUserId } = useAppSelector((s) => s.auth);
  const [sortBy, setSortBy] = useState<ReviewSortBy>("popular");
  const [page, setPage] = useState(1);

  // 409 döndüğünde hangi review'da hata gösterileceğini tutuyoruz
  const [conflictReviewId, setConflictReviewId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["movie-reviews", movieId, page, sortBy],
    queryFn: () => movieService.getReviews(movieId, page, PAGE_SIZE, sortBy),
  });

  const likeMutation = useMutation({
    mutationFn: (reviewId: string) => movieService.toggleReviewLike(reviewId),
    onSuccess: () => {
      setConflictReviewId(null);
      queryClient.invalidateQueries({
        queryKey: ["movie-reviews", movieId],
        exact: false,
      });
    },
    onError: (error: any, reviewId) => {
      if (error?.response?.status === 409) {
        setConflictReviewId(reviewId);
        // birkaç saniye sonra mesajı otomatik kaldır
        setTimeout(() => {
          setConflictReviewId((current) =>
            current === reviewId ? null : current,
          );
        }, 3000);
      }
    },
  });

  const handleSortChange = (value: ReviewSortBy) => {
    setSortBy(value);
    setPage(1);
  };

  if (isLoading) {
    return <p className="reviews-section__status">{t("common.loading")}</p>;
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="reviews-section">
        <div className="reviews-section__header">
          <h3 className="movie-detail__section-title">{t("reviews.title")}</h3>
        </div>
        <p className="reviews-section__empty">{t("reviews.empty")}</p>
      </div>
    );
  }

  return (
    <div className="reviews-section">
      <div className="reviews-section__header">
        <h3 className="movie-detail__section-title">
          {t("reviews.title")}{" "}
          <span className="reviews-section__count">({data.totalCount})</span>
        </h3>
        <div className="reviews-section__sort">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`reviews-section__sort-btn ${sortBy === opt.value ? "active" : ""}`}
              onClick={() => handleSortChange(opt.value)}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="reviews-section__list">
        {data.items.map((review) => (
          <ReviewItem
            key={review.id}
            review={review}
            isAuthenticated={isAuthenticated}
            isOwnReview={!!currentUserId && review.userId === currentUserId}
            showConflictError={conflictReviewId === review.id}
            onToggleLike={() => likeMutation.mutate(review.id)}
          />
        ))}
      </div>

      {data.totalPages > 1 && (
        <div className="reviews-section__pager">
          <button
            className="reviews-section__pager-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="reviews-section__pager-label">
            {page} / {data.totalPages}
          </span>
          <button
            className="reviews-section__pager-btn"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewItem({
  review,
  isAuthenticated,
  isOwnReview,
  showConflictError,
  onToggleLike,
}: {
  review: MovieReview;
  isAuthenticated: boolean;
  isOwnReview: boolean;
  showConflictError: boolean;
  onToggleLike: () => void;
}) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(!review.containsSpoiler);
  const serial = review.id.replace(/-/g, "").slice(0, 6).toUpperCase();

  return (
    <div className="review-item card">
      <div className="review-item__header">
        {review.userAvatarUrl ? (
          <img
            src={review.userAvatarUrl}
            alt=""
            className="review-item__avatar"
          />
        ) : (
          <span className="review-item__avatar review-item__avatar--fallback">
            <User size={14} />
          </span>
        )}
        <div className="review-item__meta">
          <span className="review-item__username">{review.userName}</span>
          <span className="review-item__date">
            {new Date(review.createdAtUtc).toLocaleDateString()}
          </span>
        </div>
        <span className="review-item__serial">#{serial}</span>
        {review.containsSpoiler && (
          <span className="review-item__spoiler-badge">
            <EyeOff size={11} /> {t("reviews.spoiler")}
          </span>
        )}
      </div>

      <div className="review-item__perf" aria-hidden="true" />

      {revealed ? (
        <p className="review-item__content">{review.content}</p>
      ) : (
        <button
          className="review-item__reveal-btn"
          onClick={() => setRevealed(true)}
        >
          {t("reviews.revealSpoiler")}
        </button>
      )}

      {isOwnReview ? (
        <span className="review-item__own-badge">
          <Heart size={14} fill="#4a90e2" />
          {review.likeCount} · {t("reviews.yourReview")}
        </span>
      ) : (
        <>
          <button
            className={`review-item__like-btn ${review.isLikedByCurrentUser ? "active" : ""}`}
            onClick={onToggleLike}
            disabled={!isAuthenticated}
          >
            <Heart
              size={14}
              fill={review.isLikedByCurrentUser ? "#4a90e2" : "none"}
            />
            {review.likeCount}
          </button>
          {showConflictError && (
            <span className="review-item__like-error">
              {t("reviews.likeOwnError")}
            </span>
          )}
        </>
      )}
    </div>
  );
}
