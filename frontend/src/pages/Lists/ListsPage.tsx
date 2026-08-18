import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ListVideo, Layers } from "lucide-react";
import { listService } from "@/services";
import { getListTheme } from "@/utils/listTheme";
import {
  PageSpinner,
  PageError,
  EmptyState,
} from "@/components/common/PageState";
import "./ListsPage.css";

export default function ListsPage() {
  const { t, i18n } = useTranslation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lists"],
    queryFn: listService.getAll,
    retry: 1,
  });

  if (isLoading) return <PageSpinner label={t("common.loading")} />;
  if (isError || !data)
    return (
      <PageError message={t("errors.listsFailed")} onRetry={() => refetch()} />
    );

  return (
    <div className="container lists-page">
      <div className="lists-page__header">
        <h1>{t("lists.title")}</h1>
        <p className="text-muted">{t("lists.subtitle")}</p>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={<ListVideo size={28} />} title={t("lists.empty")} />
      ) : (
        <div className="lists-page__grid">
          {data.map((list) => {
            const displayTitle =
              i18n.language === "tr" ? list.titleTr : list.title;
            const theme = getListTheme(list.id);
            const themeStyle = {
              "--list-accent": theme.accent,
              "--list-accent-soft": theme.accentSoft,
              "--list-accent-strong": theme.accentStrong,
            } as React.CSSProperties;

            return (
              <Link
                key={list.id}
                to={`/lists/${list.id}`}
                className="list-card card"
                style={themeStyle}
              >
                <div className="list-card__stage">
                  {list.coverImageUrl ? (
                    <img
                      src={list.coverImageUrl}
                      alt=""
                      className="list-card__stage-img"
                    />
                  ) : list.coverPosters.length > 0 ? (
                    <div className="list-card__fan">
                      {list.coverPosters.slice(0, 4).map((poster, i) => (
                        <img
                          key={i}
                          src={poster}
                          alt=""
                          className="list-card__fan-poster"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="list-card__stage-empty">
                      <Layers size={26} />
                    </div>
                  )}
                </div>

                <div className="list-card__perf" aria-hidden="true" />

                <div className="list-card__body">
                  <h3>{displayTitle}</h3>
                  <p className="text-secondary list-card__desc">
                    {list.description}
                  </p>
                  <span className="list-card__ticket">
                    {list.movieCount} {t("lists.moviesCount")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
