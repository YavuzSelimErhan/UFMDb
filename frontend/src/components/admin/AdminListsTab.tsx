import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Trash2, Pencil, Plus, Heart, Film } from "lucide-react";
import { listService } from "@/services";
import { pickListText } from "@/utils/listText";
import type { ListScope, ListStatus, ListVisibility } from "@/types";
import Pagination from "@/components/common/Pagination";
import AdminSectionHeader from "./ui/AdminSectionHeader";
import AdminSegmented from "./ui/AdminSegmented";
import AdminTableStatus from "./ui/AdminTableStatus";
import AdminThumb from "./ui/AdminThumb";

// Rotalar router tanımıyla uyuşmuyorsa sadece burayı değiştir.
const CREATE_ROUTE = "/lists/new";
const editRoute = (id: string) => `/lists/edit/${id}`;

const PAGE_SIZE = 20;
const STATUS_TONE: Record<ListStatus, string> = {
  Published: "success",
  Draft: "warning",
  Archived: "muted",
};

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
      if (page > 1 && data?.items.length === 1) setPage((p) => p - 1);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(t("admin.lists.confirmDelete", { title }))) return;
    deleteMutation.mutate(id);
  };

  return (
    <section className="admin-section">
      <AdminSectionHeader
        title={t("admin.tabs.lists")}
        subtitle={t("admin.lists.subtitle")}
        count={totalCount}
        actions={
          <button
            type="button"
            className="btn-primary admin-btn-icon"
            onClick={() => navigate(CREATE_ROUTE)}
          >
            <Plus size={15} /> {t("admin.lists.newList")}
          </button>
        }
      />

      <div className="admin-toolbar">
        <AdminSegmented<ListScope>
          value={scope}
          onChange={(s) => {
            setScope(s);
            setPage(1);
          }}
          options={[
            { value: "Official", label: t("admin.lists.scopeOfficial") },
            { value: "Community", label: t("admin.lists.scopeCommunity") },
            { value: "All", label: t("admin.lists.scopeAll") },
          ]}
        />
      </div>

      {deleteMutation.isError && (
        <p className="admin-error">{t("admin.lists.deleteError")}</p>
      )}

      <div className="admin-table-card card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.lists.colTitle")}</th>
                <th>{t("admin.lists.colStatus")}</th>
                <th>{t("admin.lists.colOwner")}</th>
                <th>{t("admin.lists.colStats")}</th>
                <th className="admin-table__actions-col">
                  {t("admin.common.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => {
                const title = pickListText(l.titleTr, l.title, i18n.language);
                const cover = l.coverImageUrl || l.coverPosters[0];
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="admin-cell">
                        <AdminThumb src={cover} name={title} shape="poster" />
                        <span className="admin-cell__title">{title}</span>
                        {l.isOfficial && (
                          <span className="admin-badge admin-badge--accent">
                            {t("admin.lists.official")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="admin-badges">
                        <span
                          className={`admin-badge admin-badge--${STATUS_TONE[l.status]}`}
                        >
                          {statusLabels[l.status]}
                        </span>
                        <span className="admin-badge admin-badge--muted">
                          {visibilityLabels[l.visibility]}
                        </span>
                      </div>
                    </td>
                    <td className="text-muted">{l.createdByUserName}</td>
                    <td>
                      <span className="admin-stats">
                        <span title={t("admin.lists.colMovies")}>
                          <Film size={13} /> {l.movieCount}
                        </span>
                        <span title={t("admin.lists.colLikes")}>
                          <Heart size={13} /> {l.likeCount}
                        </span>
                      </span>
                    </td>
                    <td className="admin-table__actions-col">
                      <div className="admin-row-actions">
                        <button
                          className="admin-icon-btn"
                          aria-label={t("common.edit")}
                          title={t("common.edit")}
                          onClick={() => navigate(editRoute(l.id))}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="admin-icon-btn admin-icon-btn--danger"
                          aria-label={t("common.delete")}
                          title={t("common.delete")}
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
              <AdminTableStatus
                colSpan={5}
                isLoading={isLoading}
                isError={isError}
                isEmpty={!isLoading && !isError && items.length === 0}
              />
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        )}
      </div>
    </section>
  );
}
