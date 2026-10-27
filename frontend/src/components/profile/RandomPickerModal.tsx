import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Dice5, X } from "lucide-react";
import type { MovieListItem } from "@/types";
import "./RandomPickerModal.css";

const CARD_W = 140;
const GAP = 10;
const STEP = CARD_W + GAP;
const REEL_LEN = 60;
const WIN_INDEX = 50;
const SPIN_MS = 5200;

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
  const trackRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const reduceMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [fast, setFast] = useState(mode === "instant" || reduceMotion);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(fast);

  const { reel, winner } = useMemo(() => build(pool), [pool, round]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (fast) {
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
      track.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
      track.style.transform = `translateX(${x}px)`;
    });
    return () => cancelAnimationFrame(id);
  }, [round, fast]);

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
          className="picker__close"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X size={18} />
        </button>

        {!fast && (
          <div className={`picker__stage ${done ? "is-done" : ""}`}>
            <div className="picker__viewport" ref={viewportRef}>
              <div className="picker__marker" />
              <div
                className="picker__track"
                ref={trackRef}
                onTransitionEnd={() => setDone(true)}
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
                onClick={() => setFast(true)}
              >
                {t("watchlist.picker.skip")}
              </button>
            )}
          </div>
        )}

        {done && (
          <div className="picker__result">
            <img src={winner.posterUrl} alt={winner.title} />
            <div className="picker__result-meta">
              <p className="picker__eyebrow">{t("watchlist.picker.tonight")}</p>
              <h3>{winner.title}</h3>
              <span>{winner.releaseYear}</span>
              <div className="picker__actions">
                <button
                  type="button"
                  className="picker__primary"
                  onClick={() => navigate(`/movies/${winner.id}`)}
                >
                  {t("watchlist.picker.go")}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRound((r) => r + 1)}
                >
                  <Dice5 size={15} /> {t("watchlist.picker.again")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
