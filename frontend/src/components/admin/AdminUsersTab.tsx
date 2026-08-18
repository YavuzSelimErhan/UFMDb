import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldOff, UserCheck, UserX } from "lucide-react";
import { userService } from "@/services";
import { useAppSelector } from "@/store";
import Pagination from "@/components/common/Pagination";
import "./AdminTabs.css";

export default function AdminUsersTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentUserId = useAppSelector((s) => s.auth.userId);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const { data } = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () => userService.search(search, page, 20),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "Admin" | "User" }) =>
      userService.updateRole(id, role),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const activeMutation = useMutation({
    mutationFn: (id: string) => userService.toggleActive(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div className="admin-users-tab">
      <input
        className="admin-users-tab__search"
        placeholder={t("admin.users.searchPlaceholder")}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      <div className="admin-tab__list card">
        <h3>
          {t("admin.users.title")} ({data?.totalCount ?? 0})
        </h3>
        <table>
          <thead>
            <tr>
              <th>{t("admin.users.colUsername")}</th>
              <th>{t("admin.users.colEmail")}</th>
              <th>{t("admin.users.colRole")}</th>
              <th>{t("admin.users.colStatus")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id}>
                  <td>{u.userName}</td>
                  <td className="text-muted">{u.email}</td>
                  <td>
                    <span
                      className={`admin-users-tab__role-badge ${u.role === "Admin" ? "is-admin" : ""}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-users-tab__status-badge ${u.isActive ? "is-active" : "is-inactive"}`}
                    >
                      {u.isActive
                        ? t("admin.users.statusActive")
                        : t("admin.users.statusInactive")}
                    </span>
                  </td>
                  <td className="admin-tab__row-actions">
                    <button
                      className="admin-tab__edit-btn"
                      title={
                        isSelf
                          ? t("admin.users.cannotChangeSelf")
                          : u.role === "Admin"
                            ? t("admin.users.makeUser")
                            : t("admin.users.makeAdmin")
                      }
                      disabled={isSelf || roleMutation.isPending}
                      onClick={() =>
                        roleMutation.mutate({
                          id: u.id,
                          role: u.role === "Admin" ? "User" : "Admin",
                        })
                      }
                    >
                      {u.role === "Admin" ? (
                        <ShieldOff size={15} />
                      ) : (
                        <Shield size={15} />
                      )}
                    </button>
                    <button
                      className={
                        u.isActive
                          ? "admin-tab__delete-btn"
                          : "admin-tab__edit-btn"
                      }
                      title={
                        isSelf
                          ? t("admin.users.cannotChangeSelf")
                          : u.isActive
                            ? t("admin.users.deactivate")
                            : t("admin.users.activate")
                      }
                      disabled={isSelf || activeMutation.isPending}
                      onClick={() => activeMutation.mutate(u.id)}
                    >
                      {u.isActive ? (
                        <UserX size={15} />
                      ) : (
                        <UserCheck size={15} />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
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
