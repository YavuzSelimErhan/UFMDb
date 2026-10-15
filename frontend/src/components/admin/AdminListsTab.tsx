import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Trash2,
  Pencil,
  Plus,
  Heart,
  Film,
  User,
  Image as ImageIcon,
} from "lucide-react";
import { listService } from "@/services";
import { pickListText } from "@/utils/listText";
import type { ListScope, ListStatus, ListVisibility } from "@/types";
import "./AdminTabs.css";
import "./AdminListsTab.css";

// Rotalar router tanımıyla uyuşmuyorsa sadece burayı değiştir.
const CREATE_ROUTE = "/lists/new";
const editRoute = (id: string) => `/lists/${id}/edit`;

const PAGE_SIZE = 20;
const SCOPES: ListScope[] = ["Official", "Community", "All"];

export default function AdminListsTab() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<ListScope>("Official");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lists", "admin", scope, page],
    queryFn: () =>
      listService.getAll({ scope, sort: "Newest", page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => listService.remove(id),
    onSuccess: () => {
      // Sayfadaki son kayıt silindiyse bir önceki sayfaya dön.
      if (page > 1 && data?.items.length === 1) setPage((p) => p - 1);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const scopeLabels: Record<string, string> = {
    Official: t("admin.lists.scopeOfficial"),
    Community: t("admin.lists.scopeCommunity"),
    All: t("admin.lists.scopeAll"),
  };
  const statusLabels: Record<ListStatus, string> = {
    Published: t("lists.form.statusPublished"),
    Draft: t("lists.form.statusDraft"),
    Archived: t("lists.form.statusArchived"),
  };
  const visibilityLabels: Record<ListVisibility, string> = {
    Public: t("lists.form.visPublic"),
    Unlisted: t("lists.form.visUnlisted"),
    Private: t("lists.form.visPrivate"),
  };

  const changeScope = (s: ListScope) => {
    setScope(s);
    setPage(1);
  };

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(t("admin.lists.confirmDelete", { title }))) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="admin-tab">
      <div className="admin-tab__list card admin-lists">
        <header className="admin-lists__head">
          <h3>
            {t("admin.lists.listTitle")}
            <span className="admin-lists__total">{totalCount}</span>
          </h3>
          <button
            type="button"
            className="btn-primary admin-lists__new"
            onClick={() => navigate(CREATE_ROUTE)}
          >
            <Plus size={14} /> {t("admin.lists.newList")}
          </button>
        </header>

        <div className="admin-lists__scopes" role="group">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              className={scope === s ? "is-active" : ""}
              onClick={() => changeScope(s)}
            >
              {scopeLabels[s]}
            </button>
          ))}
        </div>

        {isError && (
          <p className="admin-movie-form__error">
            {t("admin.lists.loadError")}
          </p>
        )}
        {deleteMutation.isError && (
          <p className="admin-movie-form__error">
            {t("admin.lists.deleteError")}
          </p>
        )}

        <ul className="admin-lists__rows" aria-busy={isLoading}>
          {items.map((l) => {
            const title = pickListText(l.titleTr, l.title, i18n.language);
            const cover = l.coverImageUrl || l.coverPosters[0];
            return (
              <li key={l.id} className="admin-lists__row">
                <div className="admin-lists__thumb">
                  {cover ? (
                    <img src={cover} alt="" loading="lazy" />
                  ) : (
                    <ImageIcon size={16} />
                  )}
                </div>

                <div className="admin-lists__info">
                  <div className="admin-lists__title-line">
                    <strong className="admin-lists__title">{title}</strong>
                    {l.isOfficial && (
                      <span className="admin-lists__badge">
                        {t("admin.lists.official")}
                      </span>
                    )}
                  </div>
                  <div className="admin-lists__meta">
                    <span
                      className={`admin-lists__chip admin-lists__chip--${l.status.toLowerCase()}`}
                    >
                      {statusLabels[l.status]}
                    </span>
                    <span className="admin-lists__chip">
                      {visibilityLabels[l.visibility]}
                    </span>
                    <span className="admin-lists__stat">
                      <User size={12} /> {l.createdByUserName}
                    </span>
                    <span className="admin-lists__stat">
                      <Film size={12} /> {l.movieCount}
                    </span>
                    <span className="admin-lists__stat">
                      <Heart size={12} /> {l.likeCount}
                    </span>
                  </div>
                </div>

                <div className="admin-tab__row-actions admin-lists__actions">
                  <button
                    className="admin-tab__edit-btn"
                    aria-label={t("common.edit")}
                    title={t("common.edit")}
                    onClick={() => navigate(editRoute(l.id))}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="admin-tab__delete-btn"
                    aria-label={t("common.delete")}
                    title={t("common.delete")}
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(l.id, title)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
          {!isLoading && items.length === 0 && (
            <li className="text-muted admin-lists__empty">
              {t("search.noResults")}
            </li>
          )}
        </ul>

        {totalPages > 1 && (
          <div className="admin-lists__pager">
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("admin.lists.prevPage")}
            </button>
            <span>{t("admin.lists.pageOf", { page, total: totalPages })}</span>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("admin.lists.nextPage")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
