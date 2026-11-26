import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Trash2, Pencil, Plus, Star } from "lucide-react";
import { movieService } from "@/services";
import { useAdminListState } from "@/hooks/useAdminListState";
import Pagination from "@/components/common/Pagination";
import AdminMovieForm from "./AdminMovieForm";
import AdminDrawer from "./ui/AdminDrawer";
import AdminSearchBox from "./ui/AdminSearchBox";
import AdminSectionHeader from "./ui/AdminSectionHeader";
import AdminTableStatus from "./ui/AdminTableStatus";
import AdminThumb from "./ui/AdminThumb";

const PAGE_SIZE = 20;
/** null = kapalı, {} = yeni film, { id } = düzenleme */
type DrawerState = { id?: string } | null;

export default function AdminMoviesTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { input, setInput, search, page, setPage } = useAdminListState();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["movie-search-admin", page, search],
    queryFn: () =>
      movieService.search({
        page,
        pageSize: PAGE_SIZE,
        sortBy: "title",
        title: search || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => movieService.remove(id),
    onSuccess: (_d, id) => {
      // Sayfadaki son kayıt silindiyse bir önceki sayfaya dön.
      if (page > 1 && data?.items.length === 1) setPage((p) => p - 1);
      if (drawer?.id === id) closeDrawer();
      queryClient.invalidateQueries({ queryKey: ["movie-search-admin"] });
    },
  });

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(t("admin.movies.confirmDelete", { title }))) return;
    deleteMutation.mutate(id);
  };

  const items = data?.items ?? [];

  return (
    <section className="admin-section">
      <AdminSectionHeader
        title={t("admin.tabs.movies")}
        subtitle={t("admin.movies.subtitle")}
        count={data?.totalCount}
        actions={
          <button
            type="button"
            className="btn-primary admin-btn-icon"
            onClick={() => setDrawer({})}
          >
            <Plus size={15} /> {t("admin.movies.newMovie")}
          </button>
        }
      />

      <div className="admin-toolbar">
        <AdminSearchBox
          value={input}
          onChange={setInput}
          placeholder={t("admin.movies.searchPlaceholder")}
        />
      </div>

      {deleteMutation.isError && (
        <p className="admin-error">{t("admin.movies.deleteError")}</p>
      )}

      <div className="admin-table-card card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.movies.colTitle")}</th>
                <th>{t("admin.movies.colYear")}</th>
                <th>{t("admin.movies.colRating")}</th>
                <th className="admin-table__actions-col">
                  {t("admin.common.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr
                  key={m.id}
                  className={drawer?.id === m.id ? "is-editing" : ""}
                >
                  <td>
                    <div className="admin-cell">
                      <AdminThumb
                        src={m.posterUrl}
                        name={m.title}
                        shape="poster"
                      />
                      <span className="admin-cell__title">{m.title}</span>
                    </div>
                  </td>
                  <td className="text-muted">{m.releaseYear}</td>
                  <td>
                    <span className="admin-rating">
                      <Star size={13} /> {m.averageRating.toFixed(1)}
                    </span>
                  </td>
                  <td className="admin-table__actions-col">
                    <div className="admin-row-actions">
                      <button
                        className="admin-icon-btn"
                        aria-label={t("common.edit")}
                        title={t("common.edit")}
                        onClick={() => setDrawer({ id: m.id })}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="admin-icon-btn admin-icon-btn--danger"
                        aria-label={t("common.delete")}
                        title={t("common.delete")}
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(m.id, m.title)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              <AdminTableStatus
                colSpan={4}
                isLoading={isLoading}
                isError={isError}
                isEmpty={!isLoading && !isError && items.length === 0}
              />
            </tbody>
          </table>
        </div>
        {data && data.totalPages > 1 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={setPage}
          />
        )}
      </div>

      <AdminDrawer
        open={!!drawer}
        title={
          drawer?.id ? t("admin.movies.editMovie") : t("admin.movies.newMovie")
        }
        onClose={closeDrawer}
      >
        {drawer && (
          <AdminMovieForm
            key={drawer.id ?? "create"}
            movieId={drawer.id}
            onDone={() => {
              closeDrawer();
              queryClient.invalidateQueries({
                queryKey: ["movie-search-admin"],
              });
            }}
            onCancel={closeDrawer}
          />
        )}
      </AdminDrawer>
    </section>
  );
}
