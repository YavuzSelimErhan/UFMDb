import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Calendar, ChevronDown } from "lucide-react";
import "./YearPicker.css";

interface Props {
  value?: number;
  decadeValue?: number; // seçili dekatın başlangıç yılı, örn. 1990
  onChangeYear: (year: number | undefined) => void;
  onChangeDecade: (decadeStart: number | undefined) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const EARLIEST_DECADE = 1900;

function getDecades(): number[] {
  const startDecade = Math.floor(CURRENT_YEAR / 10) * 10;
  const decades: number[] = [];
  for (let d = startDecade; d >= EARLIEST_DECADE; d -= 10) decades.push(d);
  return decades;
}

export default function YearPicker({
  value,
  decadeValue,
  onChangeYear,
  onChangeDecade,
}: Props) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeDecade, setActiveDecade] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setActiveDecade(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const decades = getDecades();

  const handleSelectYear = (year: number) => {
    onChangeDecade(undefined);
    onChangeYear(year);
    setIsOpen(false);
    setActiveDecade(null);
  };

  const handleSelectWholeDecade = (decadeStart: number) => {
    onChangeYear(undefined);
    onChangeDecade(decadeStart);
    setIsOpen(false);
    setActiveDecade(null);
  };

  const handleClear = () => {
    onChangeYear(undefined);
    onChangeDecade(undefined);
    setIsOpen(false);
    setActiveDecade(null);
  };

  const triggerLabel =
    value ?? (decadeValue ? `${decadeValue}s` : t("search.year"));

  return (
    <div className="year-picker" ref={containerRef}>
      <button
        type="button"
        className="year-picker__trigger"
        onClick={() => setIsOpen((v) => !v)}
      >
        <Calendar size={14} />
        <span>{triggerLabel}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="year-picker__panel card">
          {activeDecade === null ? (
            <>
              <button className="year-picker__clear" onClick={handleClear}>
                {t("search.allYears")}
              </button>
              <div className="year-picker__grid">
                {decades.map((d) => (
                  <button
                    key={d}
                    className="year-picker__cell"
                    onClick={() => setActiveDecade(d)}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                className="year-picker__back"
                onClick={() => setActiveDecade(null)}
              >
                <ChevronLeft size={14} /> {activeDecade}s
              </button>

              <button
                className={`year-picker__decade-all ${decadeValue === activeDecade ? "is-selected" : ""}`}
                onClick={() => handleSelectWholeDecade(activeDecade)}
              >
                {t("search.wholeDecade", { decade: `${activeDecade}s` })}
              </button>

              <div className="year-picker__grid">
                {Array.from({ length: 10 }, (_, i) => activeDecade + i)
                  .filter((y) => y <= CURRENT_YEAR)
                  .map((y) => (
                    <button
                      key={y}
                      className={`year-picker__cell ${value === y ? "is-selected" : ""}`}
                      onClick={() => handleSelectYear(y)}
                    >
                      {y}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
