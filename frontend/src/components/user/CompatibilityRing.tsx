import { useTranslation } from "react-i18next";
import "./CompatibilityRing.css";

interface CompatibilityRingProps {
  score: number; // 0–100
  size?: number;
}

export default function CompatibilityRing({
  score,
  size = 64,
}: CompatibilityRingProps) {
  const { t } = useTranslation();

  return (
    <div
      className="compat-ring"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={t("compatibility.title")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
    >
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle className="compat-ring__track" cx="36" cy="36" r="30" />
        <circle
          className="compat-ring__fill"
          cx="36"
          cy="36"
          r="30"
          pathLength={100}
          strokeDashoffset={100 - score}
        />
      </svg>
      <span className="compat-ring__value" style={{ fontSize: size * 0.26 }}>
        {t("compatibility.percent", { value: score })}
      </span>
    </div>
  );
}
