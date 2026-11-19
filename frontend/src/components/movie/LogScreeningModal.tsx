import { localScreeningTime } from "@/utils/screeningTime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, Loader2, Ticket, Heart, HeartCrack } from "lucide-react";
import { screeningLogService, movieService } from "@/services";
import { useToast } from "@/components/common/Toast";
import { getReaction } from "@/utils/reaction";
import StarRating from "./StarRating";
import type { MovieListItem, ReactionType } from "@/types";
import "./LogScreeningModal.css";


export type LoggableMovie = Pick<MovieListItem, "id" | "title"> &
  Partial<Pick<MovieListItem, "currentUserReaction" | "isLikedByCurrentUser">>;

interface Props {
  movie: LoggableMovie;
  onClose: () => void;
}

/**
 * Film kartlarındaki "Seans Ekle" (günlük) butonuna basıldığında açılan
 * modal. MovieDetailPage'deki satır-içi log formuyla aynı davranışı,
 * kartların bulunduğu her yerden (raflar, arama, profil, listeler...)
 * tek bir bileşenden kullanılabilir hale getirir.
 */
export default function LogScreeningModal({ movie, onClose }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [logDate, setLogDate] = useState(localScreeningTime());
  const [logRating, setLogRating] = useState(0);

  // Önceki tepki: sunucudaki güncel değer (film detayı cache'i); o gelene kadar
  // karttan gelen değer. Tepki film başına tek, seansa özel değil.
  const { data: serverReaction } = useQuery({
    queryKey: ["movie", movie.id],
    queryFn: () => movieService.getById(movie.id),
    select: (d) => d.currentUserReaction,
    staleTime: 30_000,
  });
  const initialReaction: ReactionType | null =
    serverReaction !== undefined ? serverReaction : getReaction(movie);

  // undefined = kullanıcı dokunmadı (önceki tepki geçerli), null = bilerek temizledi
  const [picked, setPicked] = useState<ReactionType | null | undefined>(
    undefined,
  );
  const reaction = picked === undefined ? initialReaction : picked;
  const pickReaction = (r: ReactionType) =>
    setPicked(reaction === r ? null : r);

  const logMutation = useMutation({
    mutationFn: async () => {
      await screeningLogService.log(
        movie.id,
        new Date(logDate).toISOString(),
        logRating > 0 ? logRating : null,
      );
      // Log yazıldıktan sonra tepkiyi uygula. Hata olursa log'u geri almıyoruz
      // (kullanıcı tekrar deneyip çift kayıt oluşturmasın), sadece haber veriyoruz.
      try {
        await movieService.setReaction(movie.id, reaction, initialReaction);
        return { reactionFailed: false };
      } catch {
        return { reactionFailed: true };
      }
    },
    onSuccess: ({ reactionFailed }) => {
      queryClient.invalidateQueries({ queryKey: ["movie", movie.id] });
      queryClient.invalidateQueries({ queryKey: ["watched-films-counts"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["watched-films"] });
      queryClient.invalidateQueries({ queryKey: ["screening-log"] });
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      if (reactionFailed) showToast(t("log.reactionSaveError"), "error");
      onClose();
    },
  });

  return (
    <div className="log-screening-backdrop" onClick={onClose}>
      <div
        className="log-screening-modal card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="log-screening-modal__header">
          <div>
            <span className="log-screening-modal__eyebrow">
              <Ticket size={12} /> {t("log.boxOffice")}
            </span>
            <h3>{movie.title}</h3>
          </div>
          <button
            type="button"
            className="log-screening-modal__close"
            onClick={onClose}
            aria-label={t("common.cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="log-screening-modal__row">
          <div className="log-screening-modal__field">
            <label>{t("log.addEntryDate")}</label>
            <input
              type="datetime-local"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              max={localScreeningTime()}
            />
          </div>
          <div className="log-screening-modal__field">
            <label>{t("log.addEntryRating")}</label>
            <StarRating value={logRating} onChange={setLogRating} />
          </div>
        </div>

        <div className="log-screening-modal__field log-screening-modal__reaction">
          <label>{t("log.reactionLabel")}</label>
          <div
            className="log-screening-modal__reaction-group"
            role="group"
            aria-label={t("log.reactionLabel")}
          >
            <button
              type="button"
              className={`log-screening-modal__reaction-btn is-like${reaction === "Like" ? " is-active" : ""}`}
              aria-pressed={reaction === "Like"}
              disabled={logMutation.isPending}
              onClick={() => pickReaction("Like")}
            >
              <Heart
                size={14}
                fill={reaction === "Like" ? "currentColor" : "none"}
              />
              {t("log.reactionLike")}
            </button>
            <button
              type="button"
              className={`log-screening-modal__reaction-btn is-dislike${reaction === "Dislike" ? " is-active" : ""}`}
              aria-pressed={reaction === "Dislike"}
              disabled={logMutation.isPending}
              onClick={() => pickReaction("Dislike")}
            >
              <HeartCrack size={14} />
              {t("movie.notForMe")}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary log-screening-modal__submit"
          disabled={logMutation.isPending}
          onClick={() => logMutation.mutate()}
        >
          {logMutation.isPending && (
            <Loader2 size={14} className="log-screening-modal__spinner" />
          )}
          {t("log.addEntrySubmit")}
        </button>
      </div>
    </div>
  );
}
