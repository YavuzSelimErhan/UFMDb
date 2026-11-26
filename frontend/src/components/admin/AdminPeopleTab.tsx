import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Trash2, Pencil, Plus } from "lucide-react";
import { personService } from "@/services";
import { useAdminListState } from "@/hooks/useAdminListState";
import Pagination from "@/components/common/Pagination";
import AdminPersonForm from "./AdminPersonForm";
import AdminDrawer from "./ui/AdminDrawer";
import AdminSearchBox from "./ui/AdminSearchBox";
import AdminSectionHeader from "./ui/AdminSectionHeader";
import AdminSegmented from "./ui/AdminSegmented";
import AdminTableStatus from "./ui/AdminTableStatus";
import AdminThumb from "./ui/AdminThumb";

const PAGE_SIZE = 20;
type RoleFilter = "" | "actor" | "director";
type DrawerState = { id?: string } | null;

export default function AdminPeopleTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { input, setInput, search, page, setPage } = useAdminListState();
  const [role, setRole] = useState<RoleFilter>("");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["people-search-admin", page, search, role],
    queryFn: () =>
      personService.search({
        search: search || undefined,
        role: role || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["people-search-admin"] });
    queryClient.invalidateQueries({ queryKey: ["people-search"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => personService.remove(id),
    onSuccess: (_d, id) => {
      if (page > 1 && data?.items.length === 1) setPage((p) => p - 1);
      if (drawer?.id === id) closeDrawer();
      invalidate();
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(t("admin.people.confirmDelete", { name }))) return;
    deleteMutation.mutate(id);
  };

  const changeRole = (r: RoleFilter) => {
    setRole(r);
    setPage(1);
  };

  const items = data?.items ?? [];

  return (
    <section className="admin-section">
      <AdminSectionHeader
        title={t("admin.tabs.people")}
        subtitle={t("admin.people.subtitle")}
        count={data?.totalCount}
        actions={
          <button
            type="button"
            className="btn-primary admin-btn-icon"
            onClick={() => setDrawer({})}
          >
            <Plus size={15} /> {t("admin.people.newPerson")}
          </button>
        }
      />

      <div className="admin-toolbar">
        <AdminSegmented<RoleFilter>
          value={role}
          onChange={changeRole}
          options={[
            { value: "", label: t("personFilmography.all") },
            { value: "actor", label: t("admin.people.actorsTab") },
            { value: "director", label: t("admin.people.directorsTab") },
          ]}
        />
        <AdminSearchBox
          value={input}
          onChange={setInput}
          placeholder={t("admin.people.searchPlaceholder")}
        />
      </div>

      {deleteMutation.isError && (
        <p className="admin-error">{t("admin.people.deleteError")}</p>
      )}

      <div className="admin-table-card card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.people.colName")}</th>
                <th>{t("admin.people.colNationality")}</th>
                <th className="admin-table__actions-col">
                  {t("admin.common.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr
                  key={p.id}
                  className={drawer?.id === p.id ? "is-editing" : ""}
                >
                  <td>
                    <div className="admin-cell">
                      <AdminThumb src={p.photoUrl} name={p.fullName} />
                      <span className="admin-cell__title">{p.fullName}</span>
                    </div>
                  </td>
                  <td className="text-muted">{p.nationality || "—"}</td>
                  <td className="admin-table__actions-col">
                    <div className="admin-row-actions">
                      <button
                        className="admin-icon-btn"
                        aria-label={t("common.edit")}
                        title={t("common.edit")}
                        onClick={() => setDrawer({ id: p.id })}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="admin-icon-btn admin-icon-btn--danger"
                        aria-label={t("common.delete")}
                        title={t("common.delete")}
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(p.id, p.fullName)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              <AdminTableStatus
                colSpan={3}
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
          drawer?.id
            ? t("admin.people.editTitle")
            : t("admin.people.createTitle")
        }
        onClose={closeDrawer}
      >
        {drawer && (
          <AdminPersonForm
            key={drawer.id ?? "create"}
            personId={drawer.id}
            onDone={closeDrawer}
            onCancel={closeDrawer}
          />
        )}
      </AdminDrawer>
    </section>
  );
}
