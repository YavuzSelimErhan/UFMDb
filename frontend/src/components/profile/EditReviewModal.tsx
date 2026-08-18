import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { movieService } from "@/services";
import type { ReviewSummary } from "@/types";
import "./EditReviewModal.css";

interface Props {
  review: ReviewSummary;
  onClose: () => void;
}

export default function EditReviewModal({ review, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [content, setContent] = useState(review.content);
  const [containsSpoiler, setContainsSpoiler] = useState(
    review.containsSpoiler,
  );

  const mutation = useMutation({
    mutationFn: () =>
      movieService.upsertReview(review.movieId, content, containsSpoiler),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="edit-review-backdrop" onClick={onClose}>
      <form
        className="edit-review-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="edit-review-modal__header">
          <div>
            <p className="edit-review-modal__eyebrow">{review.movieTitle}</p>
            <h3>{t("profile.editReview")}</h3>
          </div>
          <button
            type="button"
            className="edit-review-modal__close"
            onClick={onClose}
            aria-label={t("common.cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <textarea
          className="edit-review-modal__textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={5000}
          required
        />

        <label className="edit-review-modal__spoiler">
          <input
            type="checkbox"
            checked={containsSpoiler}
            onChange={(e) => setContainsSpoiler(e.target.checked)}
          />
          <AlertTriangle size={13} /> {t("movie.containsSpoiler")}
        </label>

        <div className="edit-review-modal__actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 size={14} className="edit-review-modal__spinner" />
            )}
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
