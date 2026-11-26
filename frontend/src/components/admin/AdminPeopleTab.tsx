import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, Search } from "lucide-react";
import { personService } from "@/services";
import AdminPersonForm from "./AdminPersonForm";
import Pagination from "@/components/common/Pagination";
import "./AdminTabs.css";

type RoleFilter = "" | "actor" | "director";

export default function AdminPeopleTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Arama ya da rol değişince ilk sayfaya dön
  useEffect(() => {
    setPage(1);
  }, [search, role]);

  const { data } = useQuery({
    queryKey: ["people-search-admin", page, search, role],
    queryFn: () =>
      personService.search({
        search: search || undefined,
        role: role || undefined,
        page,
        pageSize: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => personService.remove(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["people-search-admin"] });
      queryClient.invalidateQueries({ queryKey: ["people-search"] });
      if (editingId === id) setEditingId(null);
    },
  });

  return (
    <div className="admin-tab">
      <AdminPersonForm
        key={editingId ?? "create"}
        personId={editingId ?? undefined}
        onDone={() => setEditingId(null)}
        onCancel={editingId ? () => setEditingId(null) : undefined}
      />

      <div className="admin-tab__list card">
        <div className="admin-tab__list-header">
          <h3>
            {t("admin.people.listTitle", "Kişiler")} ({data?.totalCount ?? 0})
          </h3>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleFilter)}
            aria-label={t("admin.people.roleFilter", "Rol")}
          >
            <option value="">{t("personFilmography.all")}</option>
            <option value="actor">{t("admin.people.actorsTab")}</option>
            <option value="director">{t("admin.people.directorsTab")}</option>
          </select>
          <div className="admin-tab__search">
            <Search size={15} />
            <input
              placeholder={t("admin.people.searchPlaceholder", "Kişi ara...")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>{t("admin.people.colName", "Ad Soyad")}</th>
              <th>{t("admin.people.colNationality", "Uyruk")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id} className={editingId === p.id ? "is-editing" : ""}>
                <td>{p.fullName}</td>
                <td className="text-muted">{p.nationality || "—"}</td>
                <td className="admin-tab__row-actions">
                  <button
                    className="admin-tab__edit-btn"
                    onClick={() => setEditingId(p.id)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="admin-tab__delete-btn"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(p.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted admin-tab__empty">
                  {t("search.noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {data && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
