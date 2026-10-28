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

const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function build(pool: MovieListItem[]) {
  const winner = rand(pool);
  const reel: MovieListItem[] = [];
  for (let i = 0; i < REEL_LEN; i++) {
    if (i === WIN_INDEX) {
      reel.push(winner);
      continue;
    }
    let m = rand(pool);
    // Küçük havuzda yan yana aynı afiş olmasın.
    if (pool.length > 1 && reel[i - 1]?.id === m.id) m = rand(pool);
    reel.push(m);
  }
  return { reel, winner };
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

  const reduceMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const alwaysFast =
    mode === "instant" || reduceMotion || pool.length < MIN_SPIN_POOL;

  const [round, setRound] = useState(0);
  const [skipped, setSkipped] = useState(false); // sadece bu tur için
  const [done, setDone] = useState(alwaysFast);
  const instant = alwaysFast || skipped;

  const { reel, winner } = useMemo(() => build(pool), [pool, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const reroll = () => {
    setSkipped(false);
    setDone(alwaysFast); // yeni sonuç, animasyon bitene kadar gizli kalsın
    setRound((r) => r + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Şeridi başlat.
  useLayoutEffect(() => {
    if (instant) {
      setDone(true);
      return;
    }
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
      track.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.6, 0.15, 1)`;
      track.style.transform = `translateX(${x}px)`;
    });
    return () => cancelAnimationFrame(id);
  }, [round, instant]);

  // Ortadaki çizgiden her afiş geçtiğinde tık sesi.
  useEffect(() => {
    if (instant || done) return;
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
  }, [round, instant, done, sound.tick]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <div className="picker__viewport" ref={viewportRef}>
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
                    src={m.posterUrl}
                    alt=""
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
            <img src={winner.posterUrl} alt={winner.title} />
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
