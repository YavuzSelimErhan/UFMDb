import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { TFunction } from "i18next";
import {
  ArrowUpDown,
  Bookmark,
  Dice5,
  Download,
  MoreHorizontal,
  Search,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { profileService } from "@/services";
import MovieCard from "@/components/movie/MovieCard";
import RandomPickerModal from "@/components/profile/RandomPickerModal";
import PagedMovieGrid from "@/components/profile/PagedMovieGrid";
import WatchlistAddSearch from "@/components/profile/WatchlistAddSearch";
import { EmptyState } from "@/components/common/PageState";
import Dropdown from "@/components/search/Dropdown";
import { useScreeningLogModal } from "@/hooks/useScreeningLogModal";
import type { MovieListItem, WatchlistImportResult } from "@/types";
import "./WatchlistTab.css";

const MAX_IMPORT_BYTES = 1024 * 1024;

const SORT_OPTIONS = ["added", "title", "yearDesc", "yearAsc"] as const;
type SortKey = (typeof SORT_OPTIONS)[number];

interface Props {
  watchlist: MovieListItem[];
  isOwnProfile: boolean;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function WatchlistTab({ watchlist, isOwnProfile }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { openLog, logModal } = useScreeningLogModal();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [result, setResult] = useState<WatchlistImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("added");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<null | "spin" | "instant">(null);

  const exportMutation = useMutation({
    mutationFn: () => profileService.exportWatchlist(),
    onSuccess: (blob) => {
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `ufmdb-watchlist-${date}.csv`);
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => profileService.importWatchlist(file),
    onSuccess: (data) => {
      setImportError(null);
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (err) => {
      setResult(null);
      setImportError(resolveImportError(err, t));
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => profileService.clearWatchlist(),
    onSuccess: () => {
      setConfirmingClear(false);
      setResult(null);
      setFilter("");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });

  // Menü: dışarı tıklayınca ya da Esc ile kapanır.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const watchlistIds = useMemo(
    () => new Set(watchlist.map((m) => m.id)),
    [watchlist],
  );

  // `runtime` şu an yalnızca film detayında; liste DTO'suna eklenince (aşağıdaki
  // not) bu satır kendiliğinden çalışır, o zamana kadar süre gösterilmez.
  const totalMinutes = useMemo(
    () =>
      watchlist.reduce(
        (sum, m) =>
          sum +
          ((m as MovieListItem & { runtime?: number | null }).runtime ?? 0),
        0,
      ),
    [watchlist],
  );

  const shown = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase(i18n.language);
    let list = q
      ? watchlist.filter((m) =>
          m.title.toLocaleLowerCase(i18n.language).includes(q),
        )
      : watchlist;

    if (sort !== "added") {
      list = [...list].sort((a, b) => {
        if (sort === "title") {
          return a.title.localeCompare(b.title, i18n.language);
        }
        return sort === "yearDesc"
          ? b.releaseYear - a.releaseYear
          : a.releaseYear - b.releaseYear;
      });
    }
    return list;
  }, [watchlist, filter, sort, i18n.language]);

  const pool = shown.length > 0 ? shown : watchlist;

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // aynı dosya tekrar seçilebilsin
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      setResult(null);
      setImportError(t("watchlist.import.tooLarge"));
      return;
    }
    setImportError(null);
    setResult(null);
    importMutation.mutate(file);
  };

  const hasItems = watchlist.length > 0;
  const runtimeLabel =
    totalMinutes > 0
      ? t("watchlist.totalRuntime", {
          hours: Math.floor(totalMinutes / 60),
          minutes: totalMinutes % 60,
        })
      : null;

  return (
    <div className="watchlist-tab">
      <header className="watchlist-tab__head">
        <div>
          <h2 className="watchlist-tab__title">{t("watchlist.title")}</h2>
          <p className="watchlist-tab__count">
            {t("watchlist.count", { count: watchlist.length })}
            {runtimeLabel && ` · ${runtimeLabel}`}
          </p>
        </div>

        {hasItems && (
          <div className="watchlist-tab__random">
            <p className="watchlist-tab__random-text">
              <strong>{t("watchlist.randomTitle")}</strong>
              <span>{t("watchlist.randomHint")}</span>
            </p>
            <div className="watchlist-tab__random-btns">
              <button
                type="button"
                className="watchlist-tab__random-btn"
                onClick={() => setPicker("spin")}
              >
                <Dice5 size={15} /> {t("watchlist.random")}
              </button>
              <button
                type="button"
                className="watchlist-tab__random-btn watchlist-tab__random-btn--ghost"
                onClick={() => setPicker("instant")}
              >
                <Zap size={15} /> {t("watchlist.quickPick")}
              </button>
            </div>
          </div>
        )}
      </header>

      {isOwnProfile && <WatchlistAddSearch watchlistIds={watchlistIds} />}

      <div className="watchlist-tab__toolbar">
        {hasItems && (
          <>
            <label className="watchlist-tab__filter">
              <Search size={14} />
              <input
                type="search"
                value={filter}
                placeholder={t("watchlist.filterPlaceholder")}
                aria-label={t("watchlist.filterPlaceholder")}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            <div className="watchlist-tab__sort">
              <Dropdown
                icon={<ArrowUpDown size={14} />}
                value={sort}
                options={SORT_OPTIONS.map((o) => ({
                  value: o,
                  label: t(`watchlist.sort.${o}`),
                }))}
                onChange={(v) => setSort(v as SortKey)}
              />
            </div>
          </>
        )}

        {isOwnProfile && (
          <div className="watchlist-tab__menu" ref={menuRef}>
            <button
              type="button"
              className={`watchlist-tab__menu-btn ${menuOpen ? "is-open" : ""}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("watchlist.menu.label")}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  className="watchlist-tab__menu-backdrop"
                  aria-label={t("common.close")}
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                />
                <div className="watchlist-tab__menu-list" role="menu">
                  {hasItems && (
                    <button
                      type="button"
                      role="menuitem"
                      className="watchlist-tab__menu-item"
                      disabled={exportMutation.isPending}
                      onClick={() => {
                        setMenuOpen(false);
                        exportMutation.mutate();
                      }}
                    >
                      <Download size={16} /> {t("watchlist.export")}
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="watchlist-tab__menu-item"
                    disabled={importMutation.isPending}
                    onClick={() => {
                      setMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload size={16} /> {t("watchlist.import.button")}
                  </button>
                  {hasItems && (
                    <>
                      <div
                        className="watchlist-tab__menu-sep"
                        role="separator"
                      />
                      <button
                        type="button"
                        role="menuitem"
                        className="watchlist-tab__menu-item watchlist-tab__menu-item--danger"
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmingClear(true);
                        }}
                      >
                        <Trash2 size={16} /> {t("watchlist.clear.button")}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={onFileChosen}
            />
          </div>
        )}
      </div>

      {importMutation.isPending && (
        <p className="watchlist-tab__status" role="status">
          {t("watchlist.import.importing")}
        </p>
      )}

      {confirmingClear && (
        <div className="watchlist-tab__confirm" role="alertdialog">
          <p>{t("watchlist.clear.confirm", { count: watchlist.length })}</p>
          <div className="watchlist-tab__confirm-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmingClear(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="watchlist-tab__confirm-delete"
              disabled={clearMutation.isPending}
              onClick={() => clearMutation.mutate()}
            >
              {clearMutation.isPending
                ? t("common.loading")
                : t("watchlist.clear.confirmButton")}
            </button>
          </div>
        </div>
      )}

      {isOwnProfile && exportMutation.isError && (
        <p className="watchlist-tab__error" role="alert">
          {t("watchlist.exportFailed")}
        </p>
      )}
      {isOwnProfile && clearMutation.isError && (
        <p className="watchlist-tab__error" role="alert">
          {t("watchlist.clear.failed")}
        </p>
      )}
      {importError && (
        <p className="watchlist-tab__error" role="alert">
          {importError}
        </p>
      )}
      {result && (
        <ImportSummary result={result} onClose={() => setResult(null)} />
      )}

      {!hasItems ? (
        <EmptyState
          icon={<Bookmark size={26} />}
          title={t("profile.emptyContent")}
          hint={t("profile.watchlistHint")}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title={t("watchlist.noMatches")}
        />
      ) : (
        <PagedMovieGrid
          // Filtre/sıralama değişince "Daha fazla yükle" sayacı sıfırlansın.
          key={`${filter}|${sort}`}
          movies={shown}
          renderCard={(m) => (
            <MovieCard
              movie={m}
              interactive={isOwnProfile}
              onLogClick={isOwnProfile ? () => openLog(m) : undefined}
            />
          )}
        />
      )}

      {isOwnProfile && logModal}
      {picker && (
        <RandomPickerModal
          pool={pool}
          mode={picker}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function ImportSummary({
  result,
  onClose,
}: {
  result: WatchlistImportResult;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const stats: { key: string; value: number }[] = [
    { key: "added", value: result.added },
    { key: "alreadyInWatchlist", value: result.alreadyInWatchlist },
    { key: "duplicateRows", value: result.duplicateRows },
    { key: "notFound", value: result.notFound.length },
    { key: "invalidRows", value: result.invalidRows },
  ];

  return (
    <section className="import-summary card" aria-live="polite">
      <header className="import-summary__header">
        <h3>
          {t("watchlist.import.resultTitle", { count: result.totalRows })}
        </h3>
        <button
          type="button"
          className="import-summary__close"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>

      <ul className="import-summary__stats">
        {stats.map(({ key, value }) => (
          <li
            key={key}
            className={`import-summary__stat ${key === "added" && value > 0 ? "is-success" : ""}`}
          >
            <strong>{value}</strong>
            <span>{t(`watchlist.import.stats.${key}`)}</span>
          </li>
        ))}
      </ul>

      {result.notFound.length > 0 && (
        <details className="import-summary__misses">
          <summary>
            {t("watchlist.import.missesTitle", {
              count: result.notFound.length,
            })}
          </summary>
          <ul>
            {result.notFound.map((m) => (
              <li key={`${m.row}-${m.title}`}>
                <span className="import-summary__row">#{m.row}</span>
                <span className="import-summary__title">
                  {m.title}
                  {m.year ? ` (${m.year})` : ""}
                </span>
                <span
                  className={`import-summary__reason import-summary__reason--${m.reason.toLowerCase()}`}
                >
                  {t(`watchlist.import.reason.${m.reason}`)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function resolveImportError(err: unknown, t: TFunction): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 429) return t("watchlist.import.rateLimited");
    if (status === 413) return t("watchlist.import.tooLarge");

    // Backend mesajı: düz string (BadRequest) ya da ValidationException gövdesi.
    const data = err.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object") {
      const d = data as {
        message?: string;
        detail?: string;
        errors?: Record<string, string[]>;
      };
      const first = d.errors && Object.values(d.errors).flat()[0];
      if (first) return first;
      if (d.message) return d.message;
      if (d.detail) return d.detail;
    }
  }
  return t("watchlist.import.failed");
}
