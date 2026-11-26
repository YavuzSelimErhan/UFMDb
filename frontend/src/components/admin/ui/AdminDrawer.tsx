import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Sağdan açılan panel: formlar liste sayfasını itmeden, listenin üstünde açılır. Esc ve dış tıklama ile kapanır. */
export default function AdminDrawer({ open, title, onClose, children }: Props) {
  const { t } = useTranslation();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="admin-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="admin-drawer__backdrop" onClick={onClose} />
      <aside className="admin-drawer__panel">
        <header className="admin-drawer__head">
          <h3>{title}</h3>
          <button
            type="button"
            className="admin-icon-btn"
            onClick={onClose}
            aria-label={t("admin.common.close")}
            title={t("admin.common.close")}
          >
            <X size={18} />
          </button>
        </header>
        <div className="admin-drawer__body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
