import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dice5, Zap, Loader2 } from "lucide-react";
import type { MovieListItem } from "@/types";
import RandomPickerModal from "./RandomPickerModal";
import { unlockAudio } from "./usePickerSound";
import "./RandomPicker.css";

const EXCLUDE_KEY = "ufmdb:random-exclude-watched";

/**
 * Havuz kaynağı:
 *  - Dizi: hazır filmler (liste, izleme listesi). İzlenenleri hariç tutma bu durumda çalışır.
 *  - Fonksiyon: havuzu sunucudan çeker (arama sayfası: aktif filtrelerle rastgele örneklem).
 */
type PoolSource = MovieListItem[] | (() => Promise<MovieListItem[]>);

interface Props {
  source: PoolSource;
  /** Dışarıdan pasifleştirme (örn. arama sonucu yokken). */
  disabled?: boolean;
  /** "İzlediklerimi hariç tut" anahtarı. Sadece dizi kaynaklarında ve giriş yapmış kullanıcıda true ver. */
  allowExcludeWatched?: boolean;
  /** "24 film arasından seçilir" satırı. */
  showHint?: boolean;
  /** Yerleşim (margin, genişlik) ve tema değişkenleri için sayfanın sınıfı. */
  className?: string;
}

export default function RandomPicker({
  source,
  disabled = false,
  allowExcludeWatched = false,
  showHint = false,
  className = "",
}: Props) {
  const { t } = useTranslation();

  const [excludeWatched, setExcludeWatched] = useState(() => {
    try {
      return localStorage.getItem(EXCLUDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picker, setPicker] = useState<null | {
    mode: "spin" | "instant";
    pool: MovieListItem[];
  }>(null);

  const list = Array.isArray(source) ? source : null;
  const canExclude = allowExcludeWatched && list !== null;
  const exclude = canExclude && excludeWatched;

  // Dizi kaynağında havuz istemcide kurulur; fonksiyon kaynağında null (tıklayınca çekilir).
  const pool = useMemo(
    () =>
      list === null
        ? null
        : exclude
          ? list.filter((m) => !m.isWatchedByCurrentUser)
          : list,
    [list, exclude],
  );

  const toggleExclude = (checked: boolean) => {
    setExcludeWatched(checked);
    try {
      localStorage.setItem(EXCLUDE_KEY, checked ? "1" : "0");
    } catch {
      /* yoksay */
    }
  };

  const start = async (mode: "spin" | "instant") => {
    unlockAudio(); // Safari/iOS: ses ancak tıklama anında açılabilir (await'ten önce çağrılmalı)
    setFailed(false);
    try {
      let items: MovieListItem[];
      if (typeof source === "function") {
        setLoading(true);
        items = await source();
      } else {
        items = pool ?? [];
      }
      if (items.length > 0) setPicker({ mode, pool: items });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  // Boş dizi kaynağı: gösterecek bir şey yok.
  if (list !== null && list.length === 0) return null;

  const emptyPool = pool !== null && pool.length === 0;
  const btnDisabled = disabled || loading || emptyPool;

  const hint = emptyPool
    ? t("random.allWatched")
    : showHint && pool
      ? t("random.poolCount", { count: pool.length })
      : null;

  return (
    <div className={`random-picker ${className}`.trim()}>
      <div className="random-picker__seg">
        <button
          type="button"
          className="random-picker__btn"
          disabled={btnDisabled}
          onClick={() => start("spin")}
        >
          {loading ? (
            <Loader2 size={15} className="random-picker__spinner" />
          ) : (
            <Dice5 size={15} />
          )}{" "}
          {t("random.pick")}
        </button>
        <button
          type="button"
          className="random-picker__btn random-picker__btn--ghost"
          disabled={btnDisabled}
          onClick={() => start("instant")}
        >
          <Zap size={15} /> {t("random.quick")}
        </button>
      </div>

      {canExclude && (
        <label className="random-picker__switch">
          <input
            type="checkbox"
            role="switch"
            checked={excludeWatched}
            onChange={(e) => toggleExclude(e.target.checked)}
          />
          <span className="random-picker__track" aria-hidden="true" />
          {t("random.excludeWatched")}
        </label>
      )}

      {hint && (
        <p className="random-picker__hint" aria-live="polite">
          {hint}
        </p>
      )}

      {failed && (
        <p className="random-picker__error" role="alert">
          {t("random.failed")}
        </p>
      )}

      {picker && (
        <RandomPickerModal
          pool={picker.pool}
          mode={picker.mode}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
