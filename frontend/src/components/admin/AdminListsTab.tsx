import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, Image as ImageIcon } from "lucide-react";
import { listService } from "@/services";
import AdminListForm from "./AdminListForm";
import "./AdminTabs.css";

const CELL_STYLE = { verticalAlign: "middle" as const };

export default function AdminListsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["list-search-admin"],
    queryFn: () => listService.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => listService.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["list-search-admin"] }),
  });

  return (
    <div className="admin-tab">
      <AdminListForm
        key={editingId ?? "create"}
        listId={editingId ?? undefined}
        onDone={() => setEditingId(null)}
        onCancel={editingId ? () => setEditingId(null) : undefined}
      />

      <div className="admin-tab__list card">
        <h3>
          {t("admin.lists.listTitle")} ({data?.length ?? 0})
        </h3>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>{t("admin.lists.colTitle")}</th>
              <th>{t("admin.lists.colMovieCount")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((l) => (
              <tr key={l.id} className={editingId === l.id ? "is-editing" : ""}>
                <td className="admin-tab__thumb-cell">
                  {l.coverImageUrl ? (
                    <img
                      src={l.coverImageUrl}
                      alt=""
                      className="admin-tab__thumb"
                    />
                  ) : (
                    <div className="admin-tab__thumb admin-tab__thumb--empty">
                      <ImageIcon size={14} />
                    </div>
                  )}
                </td>
                <td>{l.titleTr}</td>
                <td>{l.movieCount}</td>
                <td>
                  <div className="admin-tab__row-actions">
                    <button
                      className="admin-tab__edit-btn"
                      onClick={() => setEditingId(l.id)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="admin-tab__delete-btn"
                      onClick={() => deleteMutation.mutate(l.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted admin-tab__empty">
                  {t("search.noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
