import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Filter, ArrowUpDown, Heart } from "lucide-react";
import { personService } from "@/services";
import { useAppSelector } from "@/store";
import MovieCard from "@/components/movie/MovieCard";
import Dropdown from "@/components/search/Dropdown";
import PersonAvatar from "@/components/common/PersonAvatar";
import { PageSpinner, PageError } from "@/components/common/PageState";
import { useScreeningLogModal } from "@/hooks/useScreeningLogModal";
import "./PersonPage.css";

const PAGE_SIZE = 36;

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  // key: kişi değişince filtre/sıralama/limit state'i sıfırlansın
  return <Profile key={id} id={id!} />;
}

function Profile({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const { openLog, logModal } = useScreeningLogModal();
  const [role, setRole] = useState("");
  const [order, setOrder] = useState<"popular" | "date">("popular");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["person", id, i18n.language],
    queryFn: () => personService.getById(id),
    retry: 1,
  });

  const likeMutation = useMutation({
    mutationFn: () => personService.toggleLike(id),
    onSuccess: () => {
      // ["person", id] öneki tüm dil varyantlarını kapsar
      queryClient.invalidateQueries({ queryKey: ["person", id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });

  if (isLoading) return <PageSpinner label={t("common.loading")} />;
  if (isError || !data)
    return (
      <PageError
        message={t("personFilmography.error")}
        onRetry={() => refetch()}
      />
    );

  const roleLabel = (job: string) =>
    job === "Cast"
      ? t("movie.cast")
      : job === "Director"
        ? t("movie.director")
        : t(`movie.jobs.${job}`, { defaultValue: job });

  const roles = Array.from(new Set(data.films.flatMap((f) => f.roles))).sort(
    (a, b) => roleLabel(a).localeCompare(roleLabel(b), i18n.language),
  );

  // filter() yeni dizi döndürdüğü için sort() orijinal veriyi bozmaz
  const films = data.films
    .filter((f) => !role || f.roles.includes(role))
    .sort((a, b) => {
      const byOrder =
        order === "date"
          ? b.movie.releaseDate.localeCompare(a.movie.releaseDate)
          : b.popularity - a.popularity;
      return byOrder || a.movie.id.localeCompare(b.movie.id);
    });

  const roleOptions = [
    { value: "", label: t("personFilmography.all") },
    ...roles.map((job) => ({ value: job, label: roleLabel(job) })),
  ];
  const orderOptions = [
    { value: "popular", label: t("personFilmography.popular") },
    { value: "date", label: t("personFilmography.date") },
  ];

  const locale = i18n.language === "tr" ? "tr-TR" : "en-US";

  return (
    <div className="container person-page">
      <div className="person-page__header">
        <PersonAvatar
          id={data.id}
          photoUrl={data.photoUrl}
          fullName={data.fullName}
          size="lg"
          className="person-page__photo"
        />
        <div className="person-page__header-info">
          <h1>{data.fullName}</h1>

          {(data.birthDate || data.nationality) && (
            <p className="text-muted person-page__meta">
              {data.birthDate &&
                `${t("actor.born")}: ${new Date(
                  data.birthDate,
                ).toLocaleDateString(locale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
              {data.birthDate && data.nationality && " · "}
              {data.nationality}
            </p>
          )}

          <p className="text-secondary person-page__bio">
            {data.biography || t("actor.noBiography")}
          </p>

          {isAuthenticated && (
            <button
              className={`btn-secondary person-page__like-btn ${data.isLikedByCurrentUser ? "active" : ""}`}
              disabled={likeMutation.isPending}
              onClick={() => likeMutation.mutate()}
            >
              <Heart
                size={16}
                fill={data.isLikedByCurrentUser ? "#4a90e2" : "none"}
              />
              {data.isLikedByCurrentUser ? t("actor.liked") : t("actor.like")}
              {data.likeCount > 0 && (
                <span className="person-page__like-count">
                  {data.likeCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="person-page__toolbar">
        <h2 className="person-page__section-title">
          {t("personFilmography.heading")}{" "}
          <span className="person-page__count">{films.length}</span>
        </h2>
        <div className="person-page__filters">
          <Dropdown
            icon={<Filter size={14} />}
            value={role}
            options={roleOptions}
            onChange={(v) => {
              setRole(v);
              setLimit(PAGE_SIZE);
            }}
          />
          <Dropdown
            accent
            icon={<ArrowUpDown size={14} />}
            value={order}
            options={orderOptions}
            onChange={(v) => {
              setOrder(v as "popular" | "date");
              setLimit(PAGE_SIZE);
            }}
          />
        </div>
      </div>

      {films.length === 0 ? (
        <p className="text-muted">{t("personFilmography.empty")}</p>
      ) : (
        <div className="movie-grid">
          {films.slice(0, limit).map((f) => (
            <MovieCard
              key={f.movie.id}
              movie={f.movie}
              onLogClick={() => openLog(f.movie)}
            />
          ))}
        </div>
      )}

      {films.length > limit && (
        <button
          className="btn-secondary person-page__more"
          onClick={() => setLimit((l) => l + PAGE_SIZE)}
        >
          {t("personFilmography.more")}
        </button>
      )}
      {logModal}
    </div>
  );
}
