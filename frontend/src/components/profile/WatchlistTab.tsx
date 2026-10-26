import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Bookmark, Download, Upload, X } from "lucide-react";
import { profileService } from "@/services";
import MovieCard from "@/components/movie/MovieCard";
import PagedMovieGrid from "@/components/profile/PagedMovieGrid";
import { EmptyState } from "@/components/common/PageState";
import { useScreeningLogModal } from "@/hooks/useScreeningLogModal";
import type { MovieListItem, WatchlistImportResult } from "@/types";
import "./WatchlistTab.css";

const MAX_IMPORT_BYTES = 1024 * 1024;

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openLog, logModal } = useScreeningLogModal();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [result, setResult] = useState<WatchlistImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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
      // Watchlist profil yanıtıyla geliyor.
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (err) => {
      setResult(null);
      setImportError(resolveImportError(err, t));
    },
  });

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

  return (
    <div className="watchlist-tab">
      {isOwnProfile && (
        <div className="watchlist-tab__toolbar">
          <button
            type="button"
            className="btn-secondary watchlist-tab__btn"
            disabled={exportMutation.isPending || watchlist.length === 0}
            onClick={() => exportMutation.mutate()}
          >
            <Download size={14} />
            {exportMutation.isPending
              ? t("common.loading")
              : t("watchlist.export")}
          </button>

          <button
            type="button"
            className="btn-secondary watchlist-tab__btn"
            disabled={importMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            {importMutation.isPending
              ? t("watchlist.import.importing")
              : t("watchlist.import.button")}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={onFileChosen}
          />
        </div>
      )}

      {isOwnProfile && exportMutation.isError && (
        <p className="watchlist-tab__error" role="alert">
          {t("watchlist.exportFailed")}
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

      {watchlist.length > 0 ? (
        <PagedMovieGrid
          movies={watchlist}
          renderCard={(m) => (
            <MovieCard
              movie={m}
              interactive={isOwnProfile}
              onLogClick={isOwnProfile ? () => openLog(m) : undefined}
            />
          )}
        />
      ) : (
        <EmptyState
          icon={<Bookmark size={26} />}
          title={t("profile.emptyContent")}
          hint={t("profile.watchlistHint")}
        />
      )}

      {isOwnProfile && logModal}
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

function resolveImportError(err: unknown, t: (k: string) => string): string {
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
