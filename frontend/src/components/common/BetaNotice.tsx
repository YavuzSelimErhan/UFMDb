import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  X,
  Mail,
  Github,
  FlaskConical,
  Copy,
  Check,
  Sparkles,
  Shuffle,
  Users,
  HeartCrack,
} from "lucide-react";
import { CONTACT } from "@/config/contact";
import "./BetaNotice.css";

/**
 * Site her açıldığında (tam sayfa yüklemesinde) gösterilen beta bilgilendirmesi.
 * Bilerek localStorage/sessionStorage'a "görüldü" bilgisi yazılmıyor: istek, uyarının
 * her girişte görünmesi. Site içi (client-side) gezinmede tekrar açılmaz.
 */
export default function BetaNotice() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      // Odak, pop-up'ın dışına kaçmasın (basit focus trap)
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  // mailto: linki, cihazda varsayılan bir mail uygulaması yoksa çalışmaz (tarayıcı boş
  // sekme açar ya da hiçbir şey yapmaz). Bu yüzden adresi panoya kopyalama seçeneği de var.
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
    } catch {
      // Eski tarayıcı / izin yok: geçici bir textarea ile kopyalamayı dene
      const ta = document.createElement("textarea");
      ta.value = CONTACT.email;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        return;
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div
      className="bn-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        ref={dialogRef}
        className="bn-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bn-title"
        aria-describedby="bn-desc"
      >
        <button
          type="button"
          className="bn-close"
          onClick={() => setOpen(false)}
          aria-label={t("betaNotice.closeAria")}
        >
          <X size={18} />
        </button>

        <div className="bn-layout">
          <div className="bn-main">
            <span className="bn-badge">
              <FlaskConical size={14} aria-hidden="true" />
              {t("betaNotice.badge")}
            </span>

            <h2 id="bn-title" className="bn-title">
              {t("betaNotice.title")}
            </h2>
            <p id="bn-desc" className="bn-desc">
              {t("betaNotice.description")}
            </p>

            <p className="bn-contact-intro">{t("betaNotice.contactIntro")}</p>
            <ul className="bn-contacts">
              {CONTACT.email && (
                <li className="bn-contact-row">
                  <a className="bn-contact" href={`mailto:${CONTACT.email}`}>
                    <Mail size={16} aria-hidden="true" />
                    <span className="bn-contact__label">
                      {t("betaNotice.emailLabel")}
                    </span>
                    <span className="bn-contact__value">{CONTACT.email}</span>
                  </a>
                  <button
                    type="button"
                    className="bn-copy"
                    onClick={copyEmail}
                    aria-label={t("betaNotice.copyAria")}
                  >
                    {copied ? (
                      <Check size={15} aria-hidden="true" />
                    ) : (
                      <Copy size={15} aria-hidden="true" />
                    )}
                    <span aria-live="polite">
                      {copied ? t("betaNotice.copied") : t("betaNotice.copy")}
                    </span>
                  </button>
                </li>
              )}
              {CONTACT.githubIssuesUrl && (
                <li>
                  <a
                    className="bn-contact"
                    href={CONTACT.githubIssuesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github size={16} aria-hidden="true" />
                    <span className="bn-contact__label">
                      {t("betaNotice.githubLabel")}
                    </span>
                  </a>
                </li>
              )}
            </ul>

            <p className="bn-thanks">{t("betaNotice.thanks")}</p>
          </div>

          <aside className="bn-soon">
            <span className="bn-soon__eyebrow">
              {t("betaNotice.soonEyebrow")}
            </span>
            <div className="bn-soon__list">
              <div className="bn-soon__item">
                <span className="bn-soon__icon">
                  <Sparkles size={16} aria-hidden="true" />
                </span>
                <div className="bn-soon__text">
                  <h4 className="bn-soon__item-title">
                    {t("betaNotice.soonRecommendTitle")}
                  </h4>
                  <p className="bn-soon__item-desc">
                    {t("betaNotice.soonRecommendDesc")}
                  </p>
                </div>
              </div>
              <div className="bn-soon__item">
                <span className="bn-soon__icon">
                  <Shuffle size={16} aria-hidden="true" />
                </span>
                <div className="bn-soon__text">
                  <h4 className="bn-soon__item-title">
                    {t("betaNotice.soonRandomTitle")}
                  </h4>
                  <p className="bn-soon__item-desc">
                    {t("betaNotice.soonRandomDesc")}
                  </p>
                </div>
              </div>
            </div>

            <span className="bn-soon__eyebrow bn-soon__eyebrow--added">
              {t("betaNotice.addedEyebrow")}
            </span>
            <div className="bn-soon__list">
              <Link
                to="/"
                className="bn-soon__item bn-soon__item--added bn-soon__item--featured"
                onClick={() => setOpen(false)}
              >
                <span className="bn-soon__icon bn-soon__icon--featured">
                  <Users size={16} aria-hidden="true" />
                </span>
                <div className="bn-soon__text">
                  <h4 className="bn-soon__item-title">
                    {t("betaNotice.addedFriendsTitle")}
                  </h4>
                  <p className="bn-soon__item-desc">
                    {t("betaNotice.addedFriendsDesc")}
                  </p>
                </div>
              </Link>

              <div className="bn-soon__item bn-soon__item--added">
                <span className="bn-soon__icon bn-soon__icon--featured">
                  <HeartCrack size={16} aria-hidden="true" />
                </span>
                <div className="bn-soon__text">
                  <h4 className="bn-soon__item-title">
                    {t("betaNotice.addedNotForMeTitle")}
                  </h4>
                  <p className="bn-soon__item-desc">
                    {t("betaNotice.addedNotForMeDesc")}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <button
          ref={confirmRef}
          type="button"
          className="btn-primary bn-confirm"
          onClick={() => setOpen(false)}
        >
          {t("betaNotice.confirm")}
        </button>
      </div>
    </div>
  );
}
