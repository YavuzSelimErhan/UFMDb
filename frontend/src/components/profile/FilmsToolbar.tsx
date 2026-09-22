import { useTranslation } from "react-i18next";
import { ArrowUpDown, LayoutGrid, LayoutList } from "lucide-react";
import Dropdown from "@/components/search/Dropdown";

export type FilterType = "all" | "rated" | "unrated";
export type ViewMode = "grid" | "masonry";

export const SORT_OPTIONS = [
  { value: "release-desc", labelKey: "releaseDesc" },
  { value: "release-asc", labelKey: "releaseAsc" },
  { value: "rating-desc", labelKey: "myRatingDesc" },
  { value: "rating-asc", labelKey: "myRatingAsc" },
  { value: "movie-rating-desc", labelKey: "filmRatingDesc" },
  { value: "movie-rating-asc", labelKey: "filmRatingAsc" },
  { value: "title-asc", labelKey: "titleAsc" },
] as const;

const FILTERS: FilterType[] = ["all", "rated", "unrated"];

// "all" -> "filmsFilterAll", "rated" -> "filmsFilterRated" ...
const filterLabelKey = (f: FilterType) =>
  `profile.filmsFilter${f[0].toUpperCase()}${f.slice(1)}`;

interface FilmsToolbarProps {
  filter: FilterType;
  onFilterChange: (v: FilterType) => void;
  counts: { all: number; rated: number; unrated: number };
  sortBy: string;
  onSortChange: (v: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}

/**
 * ProfileFilmsTab ve (istenirse) UserFilmsTab arasında paylaşılan filtre /
 * sıralama / görünüm araç çubuğu. Önceden ProfileFilmsTab içinde satır içi
 * tanımlıydı; davranış bire bir aynı, sadece prop'lar üzerinden kontrol
 * ediliyor.
 */
export default function FilmsToolbar({
  filter,
  onFilterChange,
  counts,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: FilmsToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="films-toolbar">
      <div
        className="filter-pills"
        role="tablist"
        aria-label={t("profile.filmsFilterAriaLabel")}
      >
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`pill${filter === key ? " pill-active" : ""}`}
            onClick={() => onFilterChange(key)}
          >
            {t(filterLabelKey(key))}{" "}
            <span className="pill-count">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-right">
        <Dropdown
          icon={<ArrowUpDown size={14} />}
          value={sortBy}
          options={SORT_OPTIONS.map((o) => ({
            value: o.value,
            label: t(`profile.filmsSort.${o.labelKey}`),
          }))}
          onChange={onSortChange}
        />

        <div
          className="view-toggle"
          role="group"
          aria-label={t("profile.viewModeAriaLabel")}
        >
          <button
            type="button"
            className={`view-btn${viewMode === "grid" ? " view-btn-active" : ""}`}
            onClick={() => onViewModeChange("grid")}
            aria-label={t("profile.gridView")}
            aria-pressed={viewMode === "grid"}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            className={`view-btn${viewMode === "masonry" ? " view-btn-active" : ""}`}
            onClick={() => onViewModeChange("masonry")}
            aria-label={t("profile.freeView")}
            aria-pressed={viewMode === "masonry"}
          >
            <LayoutList size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
