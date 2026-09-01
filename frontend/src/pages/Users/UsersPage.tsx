import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Users as UsersIcon, Search, X } from "lucide-react";
import { followService } from "@/services";
import UserCard from "@/components/user/UserCard";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import "./UsersPage.css";

const PAGE_SIZE = 24;

export default function UsersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["users-search", debounced, page],
    queryFn: () =>
      followService.searchUsers(debounced || undefined, page, PAGE_SIZE),
    retry: 1,
  });

  return (
    <div className="container users-page">
      <div className="users-page__header">
        <div>
          <h1>
            <UsersIcon size={22} /> {t("users.pageTitle")}
          </h1>
          <p className="text-muted">{t("users.pageSubtitle")}</p>
        </div>
        <div className="users-page__search">
          <input
            type="text"
            placeholder={t("users.searchPlaceholder") ?? ""}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search size={16} className="users-page__search-icon" />
          {search && (
            <button
              type="button"
              className="users-page__search-clear"
              onClick={() => setSearch("")}
              aria-label={t("common.clear") ?? "Temizle"}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {isLoading && <PageSpinner label={t("common.loading")} />}

      {isError && !isLoading && (
        <PageError
          message={t("errors.genericError")}
          onRetry={() => refetch()}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={<UsersIcon size={26} />}
          title={t("users.empty")}
          hint={debounced ? t("users.emptySearchHint") : undefined}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div
            className={`users-page__grid ${isFetching ? "is-fetching" : ""}`}
          >
            {data.items.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="users-page__pagination">
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("common.previous")}
              </button>
              <span className="users-page__pagination-label">
                {page} / {data.totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              >
                {t("common.next")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
