import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Trash2, Pencil, Plus, Image as ImageIcon } from "lucide-react";
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
      <div className="admin-tab__list card">
        <div className="admin-lists__toolbar">
          <h3>
            {t("admin.lists.listTitle")} ({totalCount})
          </h3>
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
          <button
            type="button"
            className="btn-primary admin-lists__new"
            onClick={() => navigate(CREATE_ROUTE)}
          >
            <Plus size={14} /> {t("admin.lists.newList")}
          </button>
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

        <table>
          <thead>
            <tr>
              <th></th>
              <th>{t("admin.lists.colTitle")}</th>
              <th>{t("admin.lists.colCreator")}</th>
              <th>{t("admin.lists.colStatus")}</th>
              <th>{t("admin.lists.colVisibility")}</th>
              <th>{t("admin.lists.colMovieCount")}</th>
              <th>{t("admin.lists.colLikes")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => {
              const title = pickListText(l.titleTr, l.title, i18n.language);
              const cover = l.coverImageUrl || l.coverPosters[0];
              return (
                <tr key={l.id}>
                  <td className="admin-tab__thumb-cell">
                    {cover ? (
                      <img src={cover} alt="" className="admin-tab__thumb" />
                    ) : (
                      <div className="admin-tab__thumb admin-tab__thumb--empty">
                        <ImageIcon size={14} />
                      </div>
                    )}
                  </td>
                  <td>
                    {title}
                    {l.isOfficial && (
                      <span className="admin-lists__badge">
                        {t("admin.lists.official")}
                      </span>
                    )}
                  </td>
                  <td>{l.createdByUserName}</td>
                  <td>{statusLabels[l.status]}</td>
                  <td>{visibilityLabels[l.visibility]}</td>
                  <td>{l.movieCount}</td>
                  <td>{l.likeCount}</td>
                  <td>
                    <div className="admin-tab__row-actions">
                      <button
                        className="admin-tab__edit-btn"
                        aria-label={t("common.edit")}
                        onClick={() => navigate(editRoute(l.id))}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="admin-tab__delete-btn"
                        aria-label={t("common.delete")}
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(l.id, title)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted admin-tab__empty">
                  {t("search.noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>

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
