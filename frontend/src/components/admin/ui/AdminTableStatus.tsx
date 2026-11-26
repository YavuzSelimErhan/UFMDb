import { useTranslation } from "react-i18next";

interface Props {
  colSpan: number;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
}

/** <tbody> içine konur: yükleniyor (iskelet), hata ya da boş durumunu tek yerden gösterir. */
export default function AdminTableStatus({
  colSpan,
  isLoading,
  isError,
  isEmpty,
}: Props) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          <tr key={i} className="admin-skeleton-row">
            <td colSpan={colSpan}>
              <span className="admin-skeleton" />
            </td>
          </tr>
        ))}
      </>
    );
  }
  if (isError) {
    return (
      <tr>
        <td
          colSpan={colSpan}
          className="admin-table__state admin-table__state--error"
        >
          {t("admin.common.loadError")}
        </td>
      </tr>
    );
  }
  if (isEmpty) {
    return (
      <tr>
        <td colSpan={colSpan} className="admin-table__state text-muted">
          {t("search.noResults")}
        </td>
      </tr>
    );
  }
  return null;
}
