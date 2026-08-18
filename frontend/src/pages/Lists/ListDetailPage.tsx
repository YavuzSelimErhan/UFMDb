import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { listService } from "@/services";
import MovieCard from "@/components/movie/MovieCard";
import { getListTheme } from "@/utils/listTheme";
import { PageSpinner, PageError } from "@/components/common/PageState";
import "./ListDetailPage.css";

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();

  const {
    data: list,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["list", id],
    queryFn: () => listService.getById(id!),
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) return <PageSpinner label={t("common.loading")} />;
  if (isError || !list)
    return (
      <PageError
        message={t("errors.listDetailFailed")}
        onRetry={() => refetch()}
      />
    );

  const displayTitle = i18n.language === "tr" ? list.titleTr : list.title;
  const theme = getListTheme(list.id);
  const themeStyle = {
    "--list-accent": theme.accent,
    "--list-accent-soft": theme.accentSoft,
    "--list-accent-strong": theme.accentStrong,
  } as React.CSSProperties;

  // Admin kapak görseli girmemişse listedeki ilk filmin backdrop/poster'ına düşüyoruz,
  // böylece hero neredeyse hiç boş kalmıyor.
  const heroImg =
    list.coverImageUrl ||
    list.movies[0]?.backdropUrl ||
    list.movies[0]?.posterUrl;

  return (
    <div className="container list-detail-page" style={themeStyle}>
      <Link to="/lists" className="list-detail-page__back">
        <ChevronLeft size={16} /> {t("lists.backToLists")}
      </Link>

      {heroImg && (
        <div className="list-detail-page__hero">
          <img src={heroImg} alt="" className="list-detail-page__hero-img" />
          <div className="list-detail-page__hero-scrim" />
        </div>
      )}

      <div className="list-detail-page__perf" aria-hidden="true" />

      <div className="list-detail-page__header">
        <span className="list-detail-page__ticket">
          {list.movies.length} {t("lists.moviesCount")}
        </span>
        <h1>{displayTitle}</h1>
        {list.description && (
          <p className="text-secondary">{list.description}</p>
        )}
      </div>

      <div className="movie-grid">
        {list.movies.map((m) => (
          <MovieCard key={m.id} movie={m} />
        ))}
      </div>
    </div>
  );
}
