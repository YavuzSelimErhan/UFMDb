import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BellOff,
  Check,
  Heart,
  ListVideo,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { notificationService } from "@/services";
import type { NotificationItem } from "@/types";
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

type Described = {
  icon: LucideIcon;
  tone: "follow" | "like" | "list";
  href: string;
  text: ReactNode;
};

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
      queryClient.setQueryData<NotificationItem[] | undefined>(
        ["notifications"],
        (prev) => prev?.map((n) => ({ ...n, isRead: true })),
      );
    },
  });

  // Tek bildirimi okundu yap: iyimser güncelleme, hata olursa sunucudan tazele.
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onMutate: (id) => {
      queryClient.setQueryData<NotificationItem[] | undefined>(
        ["notifications"],
        (prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      queryClient.setQueryData<number>(["notifications-unread-count"], (c) =>
        Math.max(0, (c ?? 0) - 1),
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count"],
      });
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

  // Dışarı tıklanınca veya Escape'e basılınca paneli kapat
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  /**
   * Bildirim türü -> ikon, metin ve hedef sayfa. Yeni tür eklemek için buraya
   * bir `case` eklemek yeterli. Bilinmeyen türler (backend frontend'den önce
   * güncellenirse) null döner ve listede gösterilmez.
   */
  function describe(n: NotificationItem): Described | null {
    const actor = n.actorFullName || n.actorUserName || "?";
    const actorHref = n.actorUserName ? `/users/${n.actorUserName}` : "/";

    switch (n.type) {
      case "Follow":
        return {
          icon: UserPlus,
          tone: "follow",
          href: actorHref,
          text: (
            <>
              <strong>{actor}</strong> {t("notifications.startedFollowingYou")}
            </>
          ),
        };
      case "ReviewLike":
        return {
          icon: Heart,
          tone: "like",
          href: n.movieId ? `/movies/${n.movieId}` : actorHref,
          text: (
            <>
              <strong>{actor}</strong>{" "}
              {n.entityTitle
                ? t("notifications.likedYourReview", { title: n.entityTitle })
                : t("notifications.likedYourReviewGeneric")}
            </>
          ),
        };
      case "ListLike": {
        const listTitle =
          (i18n.language === "tr" ? n.entityTitleTr : n.entityTitle) ??
          n.entityTitle ??
          "";
        return {
          icon: Heart,
          tone: "like",
          href: n.entityId ? `/lists/${n.entityId}` : actorHref,
          text: (
            <>
              <strong>{actor}</strong>{" "}
              {t("notifications.likedYourList", { title: listTitle })}
            </>
          ),
        };
      }
      case "ListCreated": {
        const listTitle =
          (i18n.language === "tr" ? n.entityTitleTr : n.entityTitle) ??
          n.entityTitle ??
          "";
        return {
          icon: ListVideo,
          tone: "list",
          href: n.entityId ? `/lists/${n.entityId}` : actorHref,
          text: (
            <>
              <strong>{actor}</strong>{" "}
              {t("notifications.createdList", { title: listTitle })}
            </>
          ),
        };
      }
      default:
        return null;
    }
  }

  const handleItemClick = (n: NotificationItem) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    setOpen(false);
  };

  const renderItem = (n: NotificationItem) => {
    const d = describe(n);
    if (!d || !n.actorUserId) return null;
    const Icon = d.icon;

    return (
      <li key={n.id}>
        <Link
          to={d.href}
          onClick={() => handleItemClick(n)}
          className={`notification-bell__item${!n.isRead ? " is-unread" : ""}`}
        >
          <span className="notification-bell__avatar">
            <PersonAvatar
              id={n.actorUserId}
              photoUrl={n.actorAvatarUrl}
              fullName={n.actorFullName || n.actorUserName || "?"}
              size="sm"
            />
            <span
              className={`notification-bell__type-badge notification-bell__type-badge--${d.tone}`}
              aria-hidden="true"
            >
              <Icon
                size={10}
                fill={d.tone === "like" ? "currentColor" : "none"}
              />
            </span>
          </span>
          <span className="notification-bell__item-main">
            <span className="notification-bell__item-text">{d.text}</span>
            <span className="notification-bell__item-time">
              {timeAgo(n.createdAtUtc, i18n.language)}
            </span>
          </span>
          {!n.isRead && (
            <span
              className="notification-bell__unread-dot"
              aria-hidden="true"
            />
          )}
        </Link>
      </li>
    );
  };

  const visible = (notifications ?? []).filter((n) => describe(n) !== null);
  const unreadItems = visible.filter((n) => !n.isRead);
  const readItems = visible.filter((n) => n.isRead);

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

            {!isLoading && visible.length === 0 && (
              <div className="notification-bell__empty">
                <BellOff size={26} aria-hidden="true" />
                <span>{t("notifications.empty")}</span>
              </div>
            )}

            {!isLoading && unreadItems.length > 0 && (
              <>
                <div className="notification-bell__section-label">
                  {t("notifications.sectionNew")}
                </div>
                <ul className="notification-bell__list">
                  {unreadItems.map(renderItem)}
                </ul>
              </>
            )}

            {!isLoading && readItems.length > 0 && (
              <>
                <div className="notification-bell__section-label">
                  {t("notifications.sectionEarlier")}
                </div>
                <ul className="notification-bell__list">
                  {readItems.map(renderItem)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
