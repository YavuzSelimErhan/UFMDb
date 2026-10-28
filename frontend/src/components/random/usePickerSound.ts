import { useCallback, useState } from "react";

const MUTE_KEY = "ufmdb:picker-muted";

// Tek bir AudioContext paylaşılır.
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

/** Tıklama anında çağır (Safari, sesi sadece kullanıcı hareketinde açar). */
export function unlockAudio() {
  getCtx();
}

let lastTick = 0;

export function usePickerSound() {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? "0" : "1");
      } catch {
        /* yoksay */
      }
      return !m;
    });
  }, []);

  const tick = useCallback(() => {
    if (muted) return;
    const now = performance.now();
    if (now - lastTick < 30) return; // çok sık tıklar cızırtı yapmasın
    lastTick = now;

    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(900 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }, [muted]);

  const win = useCallback(() => {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }, [muted]);

  return { tick, win, muted, toggleMuted };
}
