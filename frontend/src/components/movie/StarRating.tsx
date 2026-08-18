import { useState } from 'react';
import { Star } from 'lucide-react';

interface Props {
  value: number;              // 0.5 - 5.0
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: number;
}

/** Letterboxd tarzı yarım-puan destekli yıldız bileşeni. */
export default function StarRating({ value, onChange, readOnly = false, size = 22 }: Props) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;

  const handleClick = (starIndex: number, isHalf: boolean) => {
    if (readOnly || !onChange) return;
    onChange(isHalf ? starIndex - 0.5 : starIndex);
  };

  return (
    <div style={{ display: 'inline-flex', gap: 2 }} onMouseLeave={() => setHoverValue(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = displayValue >= star;
        const halfFilled = !filled && displayValue >= star - 0.5;

        return (
          <div
            key={star}
            style={{ position: 'relative', cursor: readOnly ? 'default' : 'pointer', width: size, height: size }}
          >
            <Star size={size} stroke="#4a90e2" fill={filled ? '#4a90e2' : 'none'} />
            {halfFilled && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', overflow: 'hidden' }}>
                <Star size={size} stroke="#4a90e2" fill="#4a90e2" />
              </div>
            )}
            {!readOnly && (
              <>
                <div
                  style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' }}
                  onMouseEnter={() => setHoverValue(star - 0.5)}
                  onClick={() => handleClick(star, true)}
                />
                <div
                  style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%' }}
                  onMouseEnter={() => setHoverValue(star)}
                  onClick={() => handleClick(star, false)}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
