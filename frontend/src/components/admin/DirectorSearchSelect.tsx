import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { directorService } from "@/services";
import "./ActorSearchSelect.css";

interface Props {
  value: string;
  displayName?: string;
  onSelect: (directorId: string, directorName: string) => void;
}

export default function DirectorSearchSelect({
  value,
  displayName,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["director-search-select", query],
    queryFn: () => directorService.search(query, 1, 6),
    enabled: query.trim().length > 0,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="actor-select" ref={containerRef}>
      <input
        placeholder={t("admin.movies.directorSearchPlaceholder")}
        value={isOpen ? query : (displayName ?? "")}
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isOpen && query.trim().length > 0 && (
        <div className="actor-select__results">
          {data?.items.length ? (
            data.items.map((d) => (
              <button
                key={d.id}
                type="button"
                className="actor-select__result"
                onClick={() => {
                  onSelect(d.id, d.fullName);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                <img src={d.photoUrl} alt="" />
                <span>{d.fullName}</span>
              </button>
            ))
          ) : (
            <p className="text-muted actor-select__empty">
              {t("search.noResults")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
