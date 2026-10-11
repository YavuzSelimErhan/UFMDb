import { Heart, HeartCrack } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactionType } from "@/types";
import "./ReactionPicker.css";

interface Props {
  value: ReactionType | null;
  onChange: (next: ReactionType | null) => void;
  disabled?: boolean;
}

/** Beğendim / Bana göre değil seçici. Aynı butona tekrar basınca tepkiyi temizler. */
export default function ReactionPicker({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const toggle = (r: ReactionType) => onChange(value === r ? null : r);

  return (
    <div
      className="reaction-picker"
      role="group"
      aria-label={t("log.reactionLabel")}
    >
      <button
        type="button"
        className={`reaction-picker__btn is-like${value === "Like" ? " is-active" : ""}`}
        aria-pressed={value === "Like"}
        disabled={disabled}
        onClick={() => toggle("Like")}
      >
        <Heart size={14} fill={value === "Like" ? "currentColor" : "none"} />
        {t("log.reactionLike")}
      </button>
      <button
        type="button"
        className={`reaction-picker__btn is-dislike${value === "Dislike" ? " is-active" : ""}`}
        aria-pressed={value === "Dislike"}
        disabled={disabled}
        onClick={() => toggle("Dislike")}
      >
        <HeartCrack size={14} />
        {t("movie.notForMe")}
      </button>
    </div>
  );
}
