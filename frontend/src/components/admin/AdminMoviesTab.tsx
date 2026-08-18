import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, Search } from "lucide-react";
import { movieService } from "@/services";
import AdminMovieForm from "./AdminMovieForm";
import Pagination from "@/components/common/Pagination";
import "./AdminTabs.css";

export default function AdminMoviesTab() {
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
    queryKey: ["movie-search-admin", page, search],
    queryFn: () =>
      movieService.search({
        page,
        pageSize: 20,
        sortBy: "title",
        title: search || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => movieService.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["movie-search-admin"] }),
  });

  return (
    <div className="admin-tab">
      <AdminMovieForm
        key={editingId ?? "create"}
        movieId={editingId ?? undefined}
        onDone={() => setEditingId(null)}
        onCancel={editingId ? () => setEditingId(null) : undefined}
      />

      <div className="admin-tab__list card">
        <div className="admin-tab__list-header">
          <h3>
            {t("admin.movies.listTitle")} ({data?.totalCount ?? 0})
          </h3>
          <div className="admin-tab__search">
            <Search size={15} />
            <input
              placeholder={t("admin.movies.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>{t("admin.movies.colTitle")}</th>
              <th>{t("admin.movies.colYear")}</th>
              <th>{t("admin.movies.colRating")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((m) => (
              <tr key={m.id} className={editingId === m.id ? "is-editing" : ""}>
                <td>{m.title}</td>
                <td>{m.releaseYear}</td>
                <td>{m.averageRating.toFixed(1)}</td>
                <td className="admin-tab__row-actions">
                  <button
                    className="admin-tab__edit-btn"
                    onClick={() => setEditingId(m.id)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="admin-tab__delete-btn"
                    onClick={() => deleteMutation.mutate(m.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted admin-tab__empty">
                  {t("admin.movies.noResults")}
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
