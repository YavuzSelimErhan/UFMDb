import { useTranslation } from "react-i18next";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Shield, ShieldOff, UserCheck, UserX } from "lucide-react";
import { userService } from "@/services";
import { useAppSelector } from "@/store";
import { useAdminListState } from "@/hooks/useAdminListState";
import Pagination from "@/components/common/Pagination";
import AdminSearchBox from "./ui/AdminSearchBox";
import AdminSectionHeader from "./ui/AdminSectionHeader";
import AdminTableStatus from "./ui/AdminTableStatus";
import AdminThumb from "./ui/AdminThumb";

const PAGE_SIZE = 20;

export default function AdminUsersTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentUserId = useAppSelector((s) => s.auth.userId);
  const { input, setInput, search, page, setPage } = useAdminListState();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () => userService.search(search, page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "Admin" | "User" }) =>
      userService.updateRole(id, role),
    onSuccess: refresh,
  });

  const activeMutation = useMutation({
    mutationFn: (id: string) => userService.toggleActive(id),
    onSuccess: refresh,
  });

  const items = data?.items ?? [];

  return (
    <section className="admin-section">
      <AdminSectionHeader
        title={t("admin.tabs.users")}
        subtitle={t("admin.users.subtitle")}
        count={data?.totalCount}
      />

      <div className="admin-toolbar">
        <AdminSearchBox
          value={input}
          onChange={setInput}
          placeholder={t("admin.users.searchPlaceholder")}
        />
      </div>

      <div className="admin-table-card card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.users.colUsername")}</th>
                <th>{t("admin.users.colEmail")}</th>
                <th>{t("admin.users.colRole")}</th>
                <th>{t("admin.users.colStatus")}</th>
                <th className="admin-table__actions-col">
                  {t("admin.common.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const isSelf = u.id === currentUserId;
                const isAdmin = u.role === "Admin";
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-cell">
                        <AdminThumb name={u.userName} />
                        <span className="admin-cell__title">{u.userName}</span>
                      </div>
                    </td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <span
                        className={`admin-badge admin-badge--${isAdmin ? "accent" : "muted"}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-badge admin-badge--${u.isActive ? "success" : "danger"}`}
                      >
                        {u.isActive
                          ? t("admin.users.statusActive")
                          : t("admin.users.statusInactive")}
                      </span>
                    </td>
                    <td className="admin-table__actions-col">
                      <div className="admin-row-actions">
                        <button
                          className="admin-icon-btn"
                          title={
                            isSelf
                              ? t("admin.users.cannotChangeSelf")
                              : isAdmin
                                ? t("admin.users.makeUser")
                                : t("admin.users.makeAdmin")
                          }
                          aria-label={
                            isAdmin
                              ? t("admin.users.makeUser")
                              : t("admin.users.makeAdmin")
                          }
                          disabled={isSelf || roleMutation.isPending}
                          onClick={() =>
                            roleMutation.mutate({
                              id: u.id,
                              role: isAdmin ? "User" : "Admin",
                            })
                          }
                        >
                          {isAdmin ? (
                            <ShieldOff size={15} />
                          ) : (
                            <Shield size={15} />
                          )}
                        </button>
                        <button
                          className={`admin-icon-btn ${u.isActive ? "admin-icon-btn--danger" : ""}`}
                          title={
                            isSelf
                              ? t("admin.users.cannotChangeSelf")
                              : u.isActive
                                ? t("admin.users.deactivate")
                                : t("admin.users.activate")
                          }
                          aria-label={
                            u.isActive
                              ? t("admin.users.deactivate")
                              : t("admin.users.activate")
                          }
                          disabled={isSelf || activeMutation.isPending}
                          onClick={() => {
                            if (
                              u.isActive &&
                              !window.confirm(
                                t("admin.users.confirmDeactivate", {
                                  name: u.userName,
                                }),
                              )
                            )
                              return;
                            activeMutation.mutate(u.id);
                          }}
                        >
                          {u.isActive ? (
                            <UserX size={15} />
                          ) : (
                            <UserCheck size={15} />
                          )}
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
        {data && data.totalPages > 1 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={setPage}
          />
        )}
      </div>
    </section>
  );
}
