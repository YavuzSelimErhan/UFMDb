import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, Check } from "lucide-react";
import { notificationService } from "@/services";
import PersonAvatar from "@/components/common/PersonAvatar";
import "./NotificationBell.css";

const MOBILE_BREAKPOINT = 560;

/** Basit, bağımlılıksız göreli zaman biçimlendirme (ör. "3 saat önce"). */
function timeAgo(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffMin < 1) return rtf.format(0, "minute");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, "hour");

  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return rtf.format(-diffDay, "day");

  const diffMonth = Math.round(diffDay / 30);
  return rtf.format(-diffMonth, "month");
}

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Panel navbar'ın overflow'u tarafından kırpılmasın diye, dar ekranlarda trigger'ın gerçek
  // ekran konumunu ölçüp paneli position:fixed ile o konuma göre yerleştiriyoruz. Geniş ekranda
  // bu null kalır ve CSS'teki normal absolute konumlandırma geçerli olur.
  const [mobilePanelStyle, setMobilePanelStyle] =
    useState<React.CSSProperties | null>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 45000,
    staleTime: 15000,
  });

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationService.getAll(),
    enabled: open,
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      queryClient.setQueryData(["notifications-unread-count"], 0);
      queryClient.setQueryData<typeof notifications>(
        ["notifications"],
        (prev) => prev?.map((n) => ({ ...n, isRead: true })),
      );
    },
  });

  // Panel açıldığında mobilde konumu hesapla.
  useEffect(() => {
    if (!open) return;

    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    if (!isMobile || !triggerRef.current) {
      setMobilePanelStyle(null);
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 12;
    setMobilePanelStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left: margin,
      right: margin,
      width: "auto",
      maxWidth: "none",
    });
  }, [open]);

  // Dışarı tıklanınca paneli kapat
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="notification-bell" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="navbar__icon-btn notification-bell__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notifications.title")}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-bell__badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notification-bell__panel"
          style={mobilePanelStyle ?? undefined}
        >
          <div className="notification-bell__header">
            <span>{t("notifications.title")}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-bell__mark-all"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                <Check size={13} />
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="notification-bell__body">
            {isLoading && (
              <div className="notification-bell__empty">
                {t("common.loading")}
              </div>
            )}

            {!isLoading && (!notifications || notifications.length === 0) && (
              <div className="notification-bell__empty">
                {t("notifications.empty")}
              </div>
            )}

            {!isLoading && notifications && notifications.length > 0 && (
              <ul className="notification-bell__list">
                {notifications.map((n) => {
                  if (n.type !== "Follow" || !n.actorUserId) return null;
                  return (
                    <li key={n.id}>
                      <Link
                        to={`/users/${n.actorUserName}`}
                        className={`notification-bell__item${!n.isRead ? " is-unread" : ""}`}
                      >
                        <PersonAvatar
                          id={n.actorUserId}
                          photoUrl={n.actorAvatarUrl}
                          fullName={n.actorFullName || n.actorUserName || "?"}
                          size="sm"
                        />
                        <span className="notification-bell__item-text">
                          <strong>{n.actorFullName || n.actorUserName}</strong>{" "}
                          {t("notifications.startedFollowingYou")}
                        </span>
                        <span className="notification-bell__item-time">
                          {timeAgo(n.createdAtUtc, i18n.language)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
