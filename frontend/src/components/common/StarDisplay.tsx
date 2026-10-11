import type { CSSProperties } from "react";
import { Star } from "lucide-react";
import "./StarDisplay.css";

interface StarDisplayProps {
  /** 0–5 arası, ondalıklı olabilir (3.5 → 3 dolu + 1 yarım yıldız). */
  value: number;
  size?: number;
  className?: string;
}

/**
 * Salt-okunur yıldız gösterimi. FriendsActivitySection ve ActivityPage'deki
 * iki ayrı `Stars` kopyasının tek kaynağı. MovieCard / StarRating'deki salt-okunur
 * yıldızlar da bu bileşene geçirilebilir.
 */
export default function StarDisplay({
  value,
  size = 15,
  className = "",
}: StarDisplayProps) {
  return (
    <span
      className={`star-display ${className}`.trim()}
      role="img"
      aria-label={value.toFixed(1)}
      style={{ "--star-size": `${size}px` } as CSSProperties}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="star-display__star">
            <Star size={size} className="star-display__base" />
            <span
              className="star-display__fill"
              style={{ width: `${fill * 100}%` }}
            >
              <Star size={size} fill="currentColor" />
            </span>
          </span>
        );
      })}
    </span>
  );
}
