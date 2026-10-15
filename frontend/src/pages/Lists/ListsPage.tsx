import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ListVideo, Plus } from "lucide-react";
import { listService } from "@/services";
import { useAppSelector } from "@/store";
import ListCard from "./ListCard";
import { pickListText } from "@/utils/listText";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import type { ListScope, ListSort } from "@/types";
import "./ListsPage.css";

const PAGE_SIZE = 24;

const TABS: { key: ListScope; labelKey: string; authOnly: boolean }[] = [
  { key: "Official", labelKey: "lists.official", authOnly: false },
  { key: "Community", labelKey: "lists.community", authOnly: false },
  { key: "Mine", labelKey: "lists.mine", authOnly: true },
  { key: "Liked", labelKey: "lists.liked", authOnly: true },
];

// Resmi sekmenin sırası DisplayOrder ile belirleniyor; sıralama seçeneği sadece diğerlerinde anlamlı.
const SORTABLE: ListScope[] = ["Community", "Mine", "Liked"];

export default function ListsPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, isSessionChecked, userId } = useAppSelector(
    (s) => s.auth,
  );
  const [selectedScope, setSelectedScope] = useState<ListScope>("Official");
  const [sort, setSort] = useState<ListSort>("Newest");

  const visibleTabs = TABS.filter((tab) => !tab.authOnly || isAuthenticated);
  // Çıkış yapılırsa Listelerim/Beğendiklerim sekmesinde takılı kalma.
  const scope = visibleTabs.some((tab) => tab.key === selectedScope)
    ? selectedScope
    : "Official";
  const showSort = SORTABLE.includes(scope);
  const effectiveSort: ListSort = showSort ? sort : "Default";

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["lists", scope, effectiveSort, userId ?? "anon"],
    queryFn: ({ pageParam }) =>
      listService.getAll({
        scope,
        sort: effectiveSort,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined;
    },
    retry: 1,
    // SessionManager'ın sayfa açılışındaki sessiz refresh'i bitmeden bu sorgu ateşlenirse
    // istek henüz token'sız (anonim) gider ve isLikedByCurrentUser hep false döner.
    // Oturum kontrolü bitene kadar bekletiyoruz.
    enabled: isSessionChecked,
  });

  const lists = data?.pages.flatMap((p) => p.items) ?? [];
  const totalCount = data?.pages[0]?.totalCount;
  const isEmpty = !!data && lists.length === 0;

  const emptyTitle =
    scope === "Mine"
      ? t("lists.emptyMine")
      : scope === "Liked"
        ? t("lists.emptyLiked")
        : t("lists.empty");

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

      <div className="lists-page__tabs" role="tablist">
        {visibleTabs.map(({ key, labelKey }) => (
          <button
            key={key}
            role="tab"
            aria-selected={scope === key}
            className={`lists-page__tab ${scope === key ? "is-active" : ""}`}
            onClick={() => setSelectedScope(key)}
          >
            {t(labelKey)}
            {scope === key && totalCount !== undefined && (
              <span className="lists-page__tab-count">{totalCount}</span>
            )}
          </button>
        ))}
      </div>

      {showSort && (
        <div className="lists-page__sort">
          <span>{t("lists.sortLabel")}</span>
          {(["Newest", "Popular"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`lists-page__pill ${sort === s ? "is-active" : ""}`}
              onClick={() => setSort(s)}
            >
              {t(s === "Newest" ? "lists.sortNewest" : "lists.sortPopular")}
            </button>
          ))}
        </div>
      )}

      {(!isSessionChecked || isLoading) && (
        <PageSpinner label={t("common.loading")} />
      )}

      {isError && !isLoading && (
        <PageError
          message={t("errors.listsFailed")}
          onRetry={() => refetch()}
        />
      )}

      {isEmpty && (
        <>
          <EmptyState icon={<ListVideo size={28} />} title={emptyTitle} />
          {scope === "Mine" && (
            <div className="lists-page__empty-cta">
              <Link to="/lists/new" className="btn-primary">
                <Plus size={15} /> {t("lists.createList")}
              </Link>
            </div>
          )}
        </>
      )}

      {lists.length > 0 && (
        <>
          <div className="lists-page__grid">
            {lists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                displayTitle={pickListText(
                  list.titleTr,
                  list.title,
                  i18n.language,
                )}
                displayDescription={pickListText(
                  list.descriptionTr,
                  list.description,
                  i18n.language,
                )}
              />
            ))}
          </div>

          {hasNextPage && (
            <button
              type="button"
              className="btn-secondary lists-page__more"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? t("common.loading") : t("lists.loadMore")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
