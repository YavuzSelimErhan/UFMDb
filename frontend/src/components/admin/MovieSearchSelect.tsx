import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { movieService } from "@/services";
import "./ActorSearchSelect.css";

interface Props {
  onSelect: (
    movieId: string,
    title: string,
    posterUrl: string,
    releaseDate: string,
  ) => void;
}

/** Listeye film eklemek için arama kutusu: seçilince listeye ekler, kutuyu temizler. */
export default function MovieSearchSelect({ onSelect }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["movie-search-select", query],
    queryFn: () => movieService.search({ title: query, page: 1, pageSize: 6 }),
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
        placeholder={t("admin.lists.movieSearchPlaceholder")}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
      />
      {isOpen && query.trim().length > 0 && (
        <div className="actor-select__results">
          {data?.items.length ? (
            data.items.map((m) => (
              <button
                key={m.id}
                type="button"
                className="actor-select__result"
                onClick={() => {
                  onSelect(m.id, m.title, m.posterUrl, m.releaseDate);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                <img src={m.posterUrl} alt="" />
                <span>
                  {m.title} ({m.releaseYear})
                </span>
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
