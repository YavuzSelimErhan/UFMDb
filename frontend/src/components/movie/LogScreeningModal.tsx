import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, Loader2, Ticket } from "lucide-react";
import { screeningLogService } from "@/services";
import StarRating from "./StarRating";
import type { MovieListItem } from "@/types";
import "./LogScreeningModal.css";

function todayLocalDateString(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

export type LoggableMovie = Pick<MovieListItem, "id" | "title">;

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
  const queryClient = useQueryClient();
  const [logDate, setLogDate] = useState(todayLocalDateString());
  const [logRating, setLogRating] = useState(0);

  const logMutation = useMutation({
    mutationFn: () =>
      screeningLogService.log(
        movie.id,
        `${logDate}T12:00:00.000Z`,
        logRating > 0 ? logRating : null,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movie", movie.id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["screening-log"] });
      queryClient.invalidateQueries({ queryKey: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["home-feed"] });
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
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              max={todayLocalDateString()}
            />
          </div>
          <div className="log-screening-modal__field">
            <label>{t("log.addEntryRating")}</label>
            <StarRating value={logRating} onChange={setLogRating} />
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
