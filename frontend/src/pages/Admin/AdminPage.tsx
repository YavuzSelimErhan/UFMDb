import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Film, Users, ListVideo, UserCog, type LucideIcon } from "lucide-react";
import AdminMoviesTab from "@/components/admin/AdminMoviesTab";
import AdminPeopleTab from "@/components/admin/AdminPeopleTab";
import AdminListsTab from "@/components/admin/AdminListsTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import "@/components/admin/ui/admin-ui.css";
import "./AdminPage.css";

type Tab = "movies" | "people" | "lists" | "users";

const TABS: { id: Tab; icon: LucideIcon; labelKey: string }[] = [
  { id: "movies", icon: Film, labelKey: "admin.tabs.movies" },
  { id: "people", icon: Users, labelKey: "admin.tabs.people" },
  { id: "lists", icon: ListVideo, labelKey: "admin.tabs.lists" },
  { id: "users", icon: UserCog, labelKey: "admin.tabs.users" },
];

export default function AdminPage() {
  const { t } = useTranslation();
  // Sekme URL'de tutulur: sayfa yenilenince ya da link paylaşılınca aynı sekme açılır (/admin?tab=people).
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((x) => x.id === params.get("tab"))?.id ?? "movies";

  return (
    <div className="admin-shell">
      <nav className="admin-shell__nav" aria-label={t("admin.panel")}>
        <p className="admin-shell__title">{t("admin.panel")}</p>
        {TABS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setParams({ tab: id }, { replace: true })}
          >
            <Icon size={17} />
            {t(labelKey)}
          </button>
        ))}
      </nav>

      <main className="admin-shell__content">
        {tab === "movies" && <AdminMoviesTab />}
        {tab === "people" && <AdminPeopleTab />}
        {tab === "lists" && <AdminListsTab />}
        {tab === "users" && <AdminUsersTab />}
      </main>
    </div>
  );
}
