import { useState } from "react";
import { useTranslation } from "react-i18next";
import AdminMoviesTab from "@/components/admin/AdminMoviesTab";
import AdminPeopleTab from "@/components/admin/AdminPeopleTab";
import AdminListsTab from "@/components/admin/AdminListsTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import "./AdminPage.css";

type Tab = "movies" | "people" | "lists" | "users";

export default function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("movies");

  return (
    <div className="container admin-page">
      <h1>{t("nav.admin")}</h1>

      <div className="admin-page__tabs">
        <button
          className={tab === "movies" ? "active" : ""}
          onClick={() => setTab("movies")}
        >
          {t("admin.tabs.movies")}
        </button>
        <button
          className={tab === "people" ? "active" : ""}
          onClick={() => setTab("people")}
        >
          {t("admin.tabs.people")}
        </button>
        <button
          className={tab === "lists" ? "active" : ""}
          onClick={() => setTab("lists")}
        >
          {t("admin.tabs.lists")}
        </button>
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          {t("admin.tabs.users")}
        </button>
      </div>

      <div className="admin-page__content">
        {tab === "movies" && <AdminMoviesTab />}
        {tab === "people" && <AdminPeopleTab />}
        {tab === "lists" && <AdminListsTab />}
        {tab === "users" && <AdminUsersTab />}
      </div>
    </div>
  );
}
