import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, Search } from "lucide-react";
import { actorService } from "@/services";
import AdminActorForm from "./AdminActorForm";
import Pagination from "@/components/common/Pagination";
import "./AdminTabs.css";

export default function AdminActorsTab() {
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
    queryKey: ["actor-search-admin", page, search],
    queryFn: () => actorService.search(search || undefined, page, 20),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => actorService.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["actor-search-admin"] }),
  });

  return (
    <div className="admin-tab">
      <AdminActorForm
        key={editingId ?? "create"}
        actorId={editingId ?? undefined}
        onDone={() => setEditingId(null)}
        onCancel={editingId ? () => setEditingId(null) : undefined}
      />

      <div className="admin-tab__list card">
        <div className="admin-tab__list-header">
          <h3>
            {t("admin.actors.listTitle")} ({data?.totalCount ?? 0})
          </h3>
          <div className="admin-tab__search">
            <Search size={15} />
            <input
              placeholder={t("admin.actors.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>{t("admin.actors.colName")}</th>
              <th>{t("admin.actors.colNationality")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((a) => (
              <tr key={a.id} className={editingId === a.id ? "is-editing" : ""}>
                <td>{a.fullName}</td>
                <td className="text-muted">{a.nationality || "—"}</td>
                <td className="admin-tab__row-actions">
                  <button
                    className="admin-tab__edit-btn"
                    onClick={() => setEditingId(a.id)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="admin-tab__delete-btn"
                    onClick={() => deleteMutation.mutate(a.id)}
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
