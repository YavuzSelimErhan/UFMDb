import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import "./Dropdown.css";

interface Option {
  label: string;
  value: string;
}

interface Props {
  icon?: React.ReactNode;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  accent?: boolean; // sort pill'i gibi vurgulu görünsün diye
}

export default function Dropdown({
  icon,
  value,
  options,
  onChange,
  accent,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div
      className={`dropdown ${accent ? "dropdown--accent" : ""}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="dropdown__trigger"
        onClick={() => setIsOpen((v) => !v)}
      >
        {icon}
        <span>{selected?.label ?? options[0]?.label}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="dropdown__panel card">
          {options.map((o) => (
            <button
              key={o.value}
              className={`dropdown__item ${o.value === value ? "is-selected" : ""}`}
              onClick={() => {
                onChange(o.value);
                setIsOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
