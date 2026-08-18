import { useState } from "react";
import { useTranslation } from "react-i18next";
import AdminActorsTab from "./AdminActorsTab";
import AdminDirectorsTab from "./AdminDirectorsTab";
import "./AdminTabs.css";

type SubTab = "actors" | "directors";

export default function AdminPeopleTab() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>("actors");

  return (
    <div className="admin-people-tab">
      <div className="admin-people-tab__switcher">
        <button
          className={`admin-people-tab__tab-btn ${subTab === "actors" ? "is-active" : ""}`}
          onClick={() => setSubTab("actors")}
        >
          {t("admin.people.actorsTab")}
        </button>
        <button
          className={`admin-people-tab__tab-btn ${subTab === "directors" ? "is-active" : ""}`}
          onClick={() => setSubTab("directors")}
        >
          {t("admin.people.directorsTab")}
        </button>
      </div>

      {subTab === "actors" ? <AdminActorsTab /> : <AdminDirectorsTab />}
    </div>
  );
}
