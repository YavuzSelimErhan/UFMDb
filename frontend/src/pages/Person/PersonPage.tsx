import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import api from "@/services/apiClient";
import MoviePoster from "@/components/common/MoviePoster";
import PersonAvatar from "@/components/common/PersonAvatar";
import { PageSpinner, PageError } from "@/components/common/PageState";
import "./PersonPage.css";

interface Film {
  id: string; title: string; posterUrl: string; year: number;
  releaseDate: string; popularity: number; roles: string[];
}
interface Person {
  id: string; fullName: string; photoUrl: string; biography: string;
  actorId?: string; directorId?: string; films: Film[];
}

export default function PersonPage() {
  const { id } = useParams();
  return <Profile key={id} id={id!} />;
}

function Profile({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const [role, setRole] = useState("");
  const [order, setOrder] = useState("popular");
  const [limit, setLimit] = useState(36);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["person", id, i18n.language],
    queryFn: async ({ signal }) => (await api.get<Person>(`/people/${id}`, { signal })).data,
  });
  if (isLoading) return <PageSpinner label={t("common.loading")} />;
  if (!data) return <PageError message={t("personFilmography.error")} onRetry={() => refetch()} />;

  const label = (job: string) => job === "Cast" ? t("movie.cast") : job === "Director"
    ? t("movie.director") : t(`movie.jobs.${job}`, { defaultValue: job });
  const roles = Array.from(new Set(data.films.flatMap(f => f.roles)))
    .sort((a, b) => label(a).localeCompare(label(b), i18n.language));
  const films = data.films.filter(f => !role || f.roles.includes(role));
  if (order === "date") films.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  return <article className="person-profile">
    <header><PersonAvatar id={id} fullName={data.fullName} photoUrl={data.photoUrl} size="lg" />
      <div><h1>{data.fullName}</h1>
        {data.actorId && <Link to={`/actors/${data.actorId}`}>{t("personFilmography.actor")}</Link>}
        {data.directorId && <Link to={`/directors/${data.directorId}`}>{t("personFilmography.director")}</Link>}
      </div>
    </header>
    {data.biography && <p>{data.biography}</p>}
    <h2>{t("personFilmography.heading")}</h2>
    <div className="person-controls">
      <label>{t("personFilmography.role")} <select value={role} onChange={e => { setRole(e.target.value); setLimit(36); }}>
        <option value="">{t("personFilmography.all")}</option>
        {roles.map(job => <option key={job} value={job}>{label(job)}</option>)}
      </select></label>
      <label>{t("personFilmography.sort")} <select value={order} onChange={e => { setOrder(e.target.value); setLimit(36); }}>
        <option value="popular">{t("personFilmography.popular")}</option>
        <option value="date">{t("personFilmography.date")}</option>
      </select></label>
    </div>
    {!films.length && <p>{t("personFilmography.empty")}</p>}
    <ul>{films.slice(0, limit).map(f => <li key={f.id}>
      <MoviePoster movie={f} className="person-film-poster" />
      <Link to={`/movies/${f.id}`}>{f.title}</Link>
      <small>{[f.year || "", ...f.roles.map(label)].filter(Boolean).join(" · ")}</small>
    </li>)}</ul>
    {films.length > limit && <button onClick={() => setLimit(limit + 36)}>{t("personFilmography.more")}</button>}
  </article>;
}
