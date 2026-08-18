import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, Search } from "lucide-react";
import { directorService } from "@/services";
import AdminDirectorForm from "./AdminDirectorForm";
import Pagination from "@/components/common/Pagination";
import "./AdminTabs.css";

export default function AdminDirectorsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data } = useQuery({
    queryKey: ["director-search-admin", page, search],
    queryFn: () => directorService.search(search || undefined, page, 20),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => directorService.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["director-search-admin"] }),
  });

  return (
    <div className="admin-tab">
      <AdminDirectorForm
        key={editingId ?? "create"}
        directorId={editingId ?? undefined}
        onDone={() => setEditingId(null)}
        onCancel={editingId ? () => setEditingId(null) : undefined}
      />

      <div className="admin-tab__list card">
        <div className="admin-tab__list-header">
          <h3>
            {t("admin.directors.listTitle")} ({data?.totalCount ?? 0})
          </h3>
          <div className="admin-tab__search">
            <Search size={15} />
            <input
              placeholder={t("admin.directors.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>{t("admin.directors.colName")}</th>
              <th>{t("admin.directors.colNationality")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((d) => (
              <tr key={d.id} className={editingId === d.id ? "is-editing" : ""}>
                <td>{d.fullName}</td>
                <td className="text-muted">{d.nationality || "—"}</td>
                <td className="admin-tab__row-actions">
                  <button
                    className="admin-tab__edit-btn"
                    onClick={() => setEditingId(d.id)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="admin-tab__delete-btn"
                    onClick={() => deleteMutation.mutate(d.id)}
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
