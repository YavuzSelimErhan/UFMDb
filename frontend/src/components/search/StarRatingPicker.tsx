import { useState } from "react";
import { Star, X } from "lucide-react";
import "./StarRatingPicker.css";

interface Props {
  value?: number;
  onChange: (value: number | undefined) => void;
}

const STAR_COUNT = 5;

export default function StarRatingPicker({ value, onChange }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const displayValue = hovered ?? value ?? 0;

  const handleClick = (rating: number) => {
    onChange(value === rating ? undefined : rating);
  };

  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement>,
    star: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    setHovered(isLeftHalf ? star - 0.5 : star);
  };

  return (
    <div className="star-picker">
      <div className="star-picker__stars" onMouseLeave={() => setHovered(null)}>
        {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => {
          const fillPercent =
            Math.max(0, Math.min(1, displayValue - (star - 1))) * 100;
          const ratingForClick = hovered !== null ? hovered : star;

          return (
            <div
              key={star}
              className="star-picker__star"
              onMouseMove={(e) => handleMouseMove(e, star)}
              onClick={() => handleClick(ratingForClick)}
            >
              <Star size={18} className="star-picker__star-outline" />
              <div
                className="star-picker__star-fill"
                style={{ width: `${fillPercent}%` }}
              >
                <Star size={18} fill="#4a90e2" stroke="#4a90e2" />
              </div>
            </div>
          );
        })}
      </div>
      {value !== undefined && (
        <>
          <span className="star-picker__value">{value}+</span>
          <button
            className="star-picker__clear"
            onClick={() => onChange(undefined)}
            aria-label="Temizle"
          >
            <X size={13} />
          </button>
        </>
      )}
    </div>
  );
}
