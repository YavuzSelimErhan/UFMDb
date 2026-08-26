import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ListVideo, Plus } from "lucide-react";
import { listService } from "@/services";
import { useAppSelector } from "@/store";
import ListCard from "./ListCard";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import type { ListScope } from "@/types";
import "./ListsPage.css";

const TABS: { key: ListScope; labelKey: string }[] = [
  { key: "Official", labelKey: "lists.official" },
  { key: "Community", labelKey: "lists.community" },
];

export default function ListsPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [scope, setScope] = useState<ListScope>("Official");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lists", scope],
    queryFn: () => listService.getAll(scope),
    retry: 1,
  });

  return (
    <div className="container lists-page">
      <div className="lists-page__header">
        <div>
          <h1>{t("lists.title")}</h1>
          <p className="text-muted">{t("lists.subtitle")}</p>
        </div>
        {isAuthenticated && (
          <Link to="/lists/new" className="btn-primary lists-page__create">
            <Plus size={15} /> {t("lists.createList")}
          </Link>
        )}
      </div>

      <div className="lists-page__tabs">
        {TABS.map(({ key, labelKey }) => (
          <button
            key={key}
            className={`lists-page__tab ${scope === key ? "is-active" : ""}`}
            onClick={() => setScope(key)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {isLoading && <PageSpinner label={t("common.loading")} />}

      {isError && !isLoading && (
        <PageError
          message={t("errors.listsFailed")}
          onRetry={() => refetch()}
        />
      )}

      {data && data.length === 0 && (
        <EmptyState icon={<ListVideo size={28} />} title={t("lists.empty")} />
      )}

      {data && data.length > 0 && (
        <div className="lists-page__grid">
          {data.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              displayTitle={i18n.language === "tr" ? list.titleTr : list.title}
            />
          ))}
        </div>
      )}
    </div>
  );
}
