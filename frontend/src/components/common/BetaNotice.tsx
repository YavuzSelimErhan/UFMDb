import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Mail, Github, FlaskConical } from "lucide-react";
import { CONTACT } from "@/config/contact";
import { getBetaNoticeText } from "./betaNoticeText";
import "./BetaNotice.css";

/**
 * Site her açıldığında (tam sayfa yüklemesinde) gösterilen beta bilgilendirmesi.
 * Bilerek localStorage/sessionStorage'a "görüldü" bilgisi yazılmıyor: istek, uyarının
 * her girişte görünmesi. Site içi (client-side) gezinmede tekrar açılmaz.
 */
export default function BetaNotice() {
  // Dil değişince (i18n.language) bileşen yeniden render olur.
  const { i18n } = useTranslation();
  const text = getBetaNoticeText(i18n.language);
  const [open, setOpen] = useState(true);
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
          aria-label={text.closeAria}
        >
          <X size={18} />
        </button>

        <span className="bn-badge">
          <FlaskConical size={14} aria-hidden="true" />
          {text.badge}
        </span>

        <h2 id="bn-title" className="bn-title">
          {text.title}
        </h2>
        <p id="bn-desc" className="bn-desc">
          {text.description}
        </p>

        <p className="bn-contact-intro">{text.contactIntro}</p>
        <ul className="bn-contacts">
          {CONTACT.email && (
            <li>
              <a className="bn-contact" href={`mailto:${CONTACT.email}`}>
                <Mail size={16} aria-hidden="true" />
                <span className="bn-contact__label">
                  {text.emailLabel}
                </span>
                <span className="bn-contact__value">{CONTACT.email}</span>
              </a>
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
                  {text.githubLabel}
                </span>
              </a>
            </li>
          )}
        </ul>

        <p className="bn-thanks">{text.thanks}</p>

        <button
          ref={confirmRef}
          type="button"
          className="btn-primary bn-confirm"
          onClick={() => setOpen(false)}
        >
          {text.confirm}
        </button>
      </div>
    </div>
  );
}
