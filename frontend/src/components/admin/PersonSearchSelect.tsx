import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { personService } from "@/services";
// Stil dosyası eski seçiciyle ortak; ActorSearchSelect.tsx'i silerken bu CSS'i
// silme (ya da PersonSearchSelect.css olarak yeniden adlandırıp buradaki import'u güncelle).
import "./SearchSelect.css";

interface Props {
  /** Sadece yer tutucu metni belirler; arama HER ZAMAN tüm kişilerde yapılır. */
  role: "actor" | "director";
  value: string;
  displayName?: string;
  onSelect: (personId: string, personName: string) => void;
}

/**
 * Arama role göre filtrelenmez: yeni eklenen bir kişinin henüz hiç kredisi olmadığı için
 * "actor"/"director" filtresi onu bulamazdı ve filme eklenemezdi.
 */
export default function PersonSearchSelect({
  role,
  displayName,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const { data } = useQuery({
    queryKey: ["people-search-select", debouncedQuery],
    queryFn: () =>
      personService.search({ search: debouncedQuery, page: 1, pageSize: 6 }),
    enabled: debouncedQuery.length > 0,
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
        placeholder={t(
          role === "actor"
            ? "admin.movies.actorSearchPlaceholder"
            : "admin.movies.directorSearchPlaceholder",
        )}
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
            data.items.map((p) => (
              <button
                key={p.id}
                type="button"
                className="actor-select__result"
                onClick={() => {
                  onSelect(p.id, p.fullName);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                <img src={p.photoUrl} alt="" />
                <span>{p.fullName}</span>
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
