import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Dice5, Volume2, VolumeX, X } from "lucide-react";
import type { MovieListItem } from "@/types";
import { usePickerSound } from "./usePickerSound";
import "./RandomPickerModal.css";

const CARD_W = 140;
const GAP = 10;
const STEP = CARD_W + GAP;
const REEL_LEN = 60;
const WIN_INDEX = 50;
const SPIN_MS = 7500;
const MIN_SPIN_POOL = 3; // bundan az filmde animasyon anlamsız
const MAX_UNIQUE = 24; // şeritte en fazla bu kadar farklı afiş: indirme ve çözümleme yükünü sınırlar
const PRELOAD_TIMEOUT_MS = 6000; // afişler bu sürede yetişmezse yine de başla

// TMDB afişlerini şerit boyutuna indir: 140px'lik kart için w342 (2x ekranda bile) yeterli.
// TMDB dışındaki adreslere ve zaten küçük boyutlara dokunmaz.
const TMDB_BIG_RE =
  /(image\.tmdb\.org\/t\/p\/)(?:w500|w780|w1280|original)(\/)/;
const reelPoster = (url: string) => url.replace(TMDB_BIG_RE, "$1w342$2");

const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function build(pool: MovieListItem[]) {
  const winner = rand(pool);
  const fillers = shuffle(pool).slice(0, MAX_UNIQUE);
  const reel: MovieListItem[] = [];
  for (let i = 0; i < REEL_LEN; i++) {
    if (i === WIN_INDEX) {
      reel.push(winner);
      continue;
    }
    let m = rand(fillers);
    // Yan yana aynı afiş olmasın.
    if (fillers.length > 1 && reel[i - 1]?.id === m.id) m = rand(fillers);
    reel.push(m);
  }
  return { reel, winner };
}

/** Afişleri önceden indirip çözümler (decode); süre dolarsa beklemeyi bırakır. */
function preloadImages(
  urls: string[],
  keep: React.MutableRefObject<HTMLImageElement[]>,
): Promise<unknown> {
  const imgs = urls.map((src) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    return img;
  });
  keep.current = imgs; // referansı tut: çözülmüş görüntüler hemen atılmasın
  const all = Promise.all(
    imgs.map((img) => img.decode().catch(() => undefined)),
  );
  const timeout = new Promise<void>((r) => setTimeout(r, PRELOAD_TIMEOUT_MS));
  return Promise.race([all, timeout]);
}

interface Props {
  pool: MovieListItem[];
  mode: "spin" | "instant";
  onClose: () => void;
}

export default function RandomPickerModal({ pool, mode, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sound = usePickerSound();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const keepRef = useRef<HTMLImageElement[]>([]);

  const reduceMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const alwaysFast =
    mode === "instant" || reduceMotion || pool.length < MIN_SPIN_POOL;

  const [round, setRound] = useState(0);
  const [skipped, setSkipped] = useState(false); // sadece bu tur için
  const [done, setDone] = useState(alwaysFast);
  const [ready, setReady] = useState(alwaysFast); // şerit afişleri yüklendi mi
  const instant = alwaysFast || skipped;

  const { reel, winner } = useMemo(() => build(pool), [pool, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const reroll = () => {
    setSkipped(false);
    setDone(alwaysFast); // yeni sonuç, animasyon bitene kadar gizli kalsın
    setReady(alwaysFast);
    setRound((r) => r + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Şerit afişlerini animasyondan ÖNCE yükle: dönerken boş kart görünmesin.
  useEffect(() => {
    if (instant) return;
    let cancelled = false;
    setReady(false);
    const urls = Array.from(new Set(reel.map((m) => reelPoster(m.posterUrl))));
    preloadImages(urls, keepRef).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reel, instant]);

  // Şeridi başlat (afişler hazır olunca).
  useLayoutEffect(() => {
    if (instant) {
      setDone(true);
      return;
    }
    if (!ready) return;
    setDone(false);
    const track = trackRef.current;
    const vp = viewportRef.current;
    if (!track || !vp) return;

    track.style.transition = "none";
    track.style.transform = "translateX(0)";
    track.getBoundingClientRect(); // reflow: başlangıç konumu uygulansın

    const jitter = (Math.random() - 0.5) * CARD_W * 0.7;
    const x = vp.clientWidth / 2 - (WIN_INDEX * STEP + CARD_W / 2 + jitter);

    const id = requestAnimationFrame(() => {
      track.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
      track.style.transform = `translateX(${x}px)`;
    });
    return () => cancelAnimationFrame(id);
  }, [round, instant, ready]);

  // Ortadaki çizgiden her afiş geçtiğinde tık sesi.
  useEffect(() => {
    if (instant || done || !ready) return;
    const track = trackRef.current;
    const vp = viewportRef.current;
    if (!track || !vp) return;

    let raf = 0;
    let last = -1;
    const loop = () => {
      const x = new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
      const idx = Math.floor((vp.clientWidth / 2 - x) / STEP);
      if (idx !== last) {
        if (last !== -1) sound.tick();
        last = idx;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [round, instant, done, ready, sound.tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sonuç belli olunca bir kez çal.
  useEffect(() => {
    if (done) sound.win();
  }, [done, round]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="picker" role="dialog" aria-modal="true">
      <button
        type="button"
        className="picker__backdrop"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div className="picker__panel">
        <button
          type="button"
          className="picker__mute"
          aria-label={
            sound.muted ? t("random.modal.unmute") : t("random.modal.mute")
          }
          onClick={sound.toggleMuted}
        >
          {sound.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button
          type="button"
          className="picker__close"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X size={18} />
        </button>

        {!instant && (
          <div className={`picker__stage ${done ? "is-done" : ""}`}>
            <div
              className={`picker__viewport ${ready ? "" : "is-loading"}`}
              ref={viewportRef}
            >
              {!ready && (
                <div className="picker__loading" role="status">
                  {t("random.modal.loading")}
                </div>
              )}
              <div className="picker__marker" />
              <div
                className="picker__track"
                ref={trackRef}
                onTransitionEnd={(e) => {
                  // Kartlardan gelen geçişler sayılmasın, sadece şeridin kayması.
                  if (
                    e.target === e.currentTarget &&
                    e.propertyName === "transform"
                  ) {
                    setDone(true);
                  }
                }}
              >
                {reel.map((m, i) => (
                  <img
                    key={i}
                    src={reelPoster(m.posterUrl)}
                    alt=""
                    decoding="async"
                    draggable={false}
                    className={`picker__card ${done && i === WIN_INDEX ? "is-winner" : ""}`}
                    style={{ width: CARD_W, marginRight: GAP }}
                  />
                ))}
              </div>
            </div>
            {!done && (
              <button
                type="button"
                className="picker__skip"
                onClick={() => setSkipped(true)}
              >
                {t("random.modal.skip")}
              </button>
            )}
          </div>
        )}

        {done && (
          <div className="picker__result">
            <img src={reelPoster(winner.posterUrl)} alt={winner.title} />
            <div className="picker__result-meta">
              <p className="picker__eyebrow">{t("random.modal.tonight")}</p>
              <h3>{winner.title}</h3>
              <span>{winner.releaseYear}</span>
              <div className="picker__actions">
                <button
                  type="button"
                  className="picker__primary"
                  onClick={() => navigate(`/movies/${winner.id}`)}
                >
                  {t("random.modal.go")}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={reroll}
                >
                  <Dice5 size={15} /> {t("random.modal.again")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
