import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  X,
  Film,
  Image as ImageIcon,
  Tag,
  Users2,
  Clapperboard,
} from "lucide-react";
import { movieService, genreService, countryService } from "@/services";
import ActorSearchSelect from "./ActorSearchSelect";
import DirectorSearchSelect from "./DirectorSearchSelect";
import type { MovieFormPayload } from "@/types";
import "./AdminMovieForm.css";

interface CastRow {
  tempId: string;
  actorId: string;
  actorName: string;
  characterName: string;
}

interface DirectorRow {
  tempId: string;
  directorId: string;
  directorName: string;
}

interface Props {
  movieId?: string;
  onDone: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM: Omit<MovieFormPayload, "genreIds" | "cast" | "directorIds"> =
  {
    title: "",
    originalTitle: "",
    overview: "",
    releaseYear: new Date().getFullYear(),
    releaseDate: new Date().toISOString().slice(0, 10),
    runtimeMinutes: 120,
    posterUrl: "",
    backdropUrl: "",
    country: "",
  };

export default function AdminMovieForm({ movieId, onDone, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const isEditMode = !!movieId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [cast, setCast] = useState<CastRow[]>([]);
  const [directors, setDirectors] = useState<DirectorRow[]>([]);

  const { data: genres } = useQuery({
    queryKey: ["genres"],
    queryFn: genreService.getAll,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: countryService.getAll,
  });

  const { data: existingMovie } = useQuery({
    queryKey: ["movie", movieId],
    queryFn: () => movieService.getById(movieId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!existingMovie) return;
    setForm({
      title: existingMovie.title,
      originalTitle: existingMovie.originalTitle,
      overview: existingMovie.overview,
      releaseYear: existingMovie.releaseYear,
      releaseDate: existingMovie.releaseDate.slice(0, 10),
      runtimeMinutes: existingMovie.runtimeMinutes,
      posterUrl: existingMovie.posterUrl,
      backdropUrl: existingMovie.backdropUrl,
      country: existingMovie.country,
    });
    setGenreIds(existingMovie.genreIds);
    setCast(
      existingMovie.cast.map((c) => ({
        tempId: crypto.randomUUID(),
        actorId: c.actorId,
        actorName: c.fullName,
        characterName: c.characterName,
      })),
    );
    setDirectors(
      existingMovie.directors.map((d) => ({
        tempId: crypto.randomUUID(),
        directorId: d.id,
        directorName: d.fullName,
      })),
    );
  }, [existingMovie]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: MovieFormPayload = {
        ...form,
        genreIds,
        directorIds: directors
          .filter((d) => d.directorId)
          .map((d) => d.directorId),
        cast: cast
          .filter((c) => c.actorId)
          .map((c, i) => ({
            actorId: c.actorId,
            characterName: c.characterName,
            order: i,
          })),
      };
      return isEditMode
        ? movieService.update(movieId!, payload)
        : movieService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movie-search-admin"] });
      if (isEditMode)
        queryClient.invalidateQueries({ queryKey: ["movie", movieId] });
      onDone();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const toggleGenre = (id: string) => {
    setGenreIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const addCastRow = () =>
    setCast((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        actorId: "",
        actorName: "",
        characterName: "",
      },
    ]);
  const removeCastRow = (tempId: string) =>
    setCast((prev) => prev.filter((c) => c.tempId !== tempId));
  const updateCastRow = (tempId: string, patch: Partial<CastRow>) =>
    setCast((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c)),
    );

  const addDirectorRow = () =>
    setDirectors((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), directorId: "", directorName: "" },
    ]);
  const removeDirectorRow = (tempId: string) =>
    setDirectors((prev) => prev.filter((d) => d.tempId !== tempId));
  const updateDirectorRow = (tempId: string, patch: Partial<DirectorRow>) =>
    setDirectors((prev) =>
      prev.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)),
    );

  return (
    <form className="admin-movie-form card" onSubmit={handleSubmit}>
      <h3>
        {isEditMode
          ? t("admin.movies.editTitle")
          : t("admin.movies.createTitle")}
      </h3>

      <div className="admin-movie-form__top">
        <div className="admin-movie-form__poster-preview">
          {form.posterUrl ? (
            <img src={form.posterUrl} alt="" />
          ) : (
            <ImageIcon size={22} className="text-muted" />
          )}
        </div>

        <div className="admin-movie-form__basic-fields">
          <div className="admin-movie-form__field">
            <label>{t("admin.movies.fieldTitle")}</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="admin-movie-form__field">
            <label>{t("admin.movies.fieldOriginalTitle")}</label>
            <input
              value={form.originalTitle}
              onChange={(e) =>
                setForm({ ...form, originalTitle: e.target.value })
              }
            />
          </div>
          <div className="admin-movie-form__field admin-movie-form__field--sm">
            <label>{t("admin.movies.fieldYear")}</label>
            <input
              type="number"
              value={form.releaseYear}
              onChange={(e) =>
                setForm({ ...form, releaseYear: Number(e.target.value) })
              }
            />
          </div>
          <div className="admin-movie-form__field admin-movie-form__field--sm">
            <label>{t("admin.movies.fieldReleaseDate")}</label>
            <input
              type="date"
              value={form.releaseDate}
              onChange={(e) =>
                setForm({ ...form, releaseDate: e.target.value })
              }
            />
          </div>
          <div className="admin-movie-form__field admin-movie-form__field--sm">
            <label>{t("admin.movies.fieldRuntime")}</label>
            <input
              type="number"
              value={form.runtimeMinutes}
              onChange={(e) =>
                setForm({ ...form, runtimeMinutes: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </div>

      <div className="admin-movie-form__field">
        <label>{t("admin.movies.fieldCountry")}</label>
        <select
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
        >
          <option value="">{t("admin.movies.selectCountry")}</option>
          {countries?.map((c) => (
            <option key={c.id} value={c.name}>
              {i18n.language === "tr" ? c.nameTr : c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-movie-form__field">
        <label className="admin-movie-form__section-label">
          <Film size={13} /> {t("admin.movies.fieldOverview")}
        </label>
        <textarea
          value={form.overview}
          onChange={(e) => setForm({ ...form, overview: e.target.value })}
          rows={3}
        />
      </div>

      <div className="admin-movie-form__section">
        <h4>
          <ImageIcon size={14} /> {t("admin.movies.sectionImages")}
        </h4>
        <div className="admin-movie-form__grid-2">
          <div className="admin-movie-form__field">
            <label>{t("admin.movies.fieldPosterUrl")}</label>
            <input
              value={form.posterUrl}
              onChange={(e) => setForm({ ...form, posterUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="admin-movie-form__field">
            <label>{t("admin.movies.fieldBackdropUrl")}</label>
            <input
              value={form.backdropUrl}
              onChange={(e) =>
                setForm({ ...form, backdropUrl: e.target.value })
              }
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      <div className="admin-movie-form__section">
        <h4>
          <Tag size={14} /> {t("admin.movies.sectionGenres")}
        </h4>
        <div className="admin-movie-form__genre-list">
          {genres?.map((g) => (
            <label
              key={g.id}
              className={`admin-movie-form__genre-chip ${genreIds.includes(g.id) ? "is-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={genreIds.includes(g.id)}
                onChange={() => toggleGenre(g.id)}
              />
              {i18n.language === "tr" ? g.nameTr : g.name}
            </label>
          ))}
        </div>
      </div>

      <div className="admin-movie-form__section">
        <div className="admin-movie-form__cast-header">
          <h4>
            <Clapperboard size={14} /> {t("admin.movies.sectionDirectors")}
          </h4>
          <button
            type="button"
            className="btn-secondary admin-movie-form__add-cast"
            onClick={addDirectorRow}
          >
            <Plus size={14} /> {t("admin.movies.addDirector")}
          </button>
        </div>
        <div className="admin-movie-form__cast-list">
          {directors.map((row, index) => (
            <div key={row.tempId} className="admin-movie-form__cast-row">
              <span className="admin-movie-form__cast-order">{index + 1}</span>
              <DirectorSearchSelect
                value={row.directorId}
                displayName={row.directorName}
                onSelect={(directorId, directorName) =>
                  updateDirectorRow(row.tempId, { directorId, directorName })
                }
              />
              <button
                type="button"
                className="admin-movie-form__remove-cast"
                onClick={() => removeDirectorRow(row.tempId)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {directors.length === 0 && (
            <p className="text-muted admin-movie-form__no-cast">
              {t("admin.movies.noDirectors")}
            </p>
          )}
        </div>
      </div>

      <div className="admin-movie-form__section">
        <div className="admin-movie-form__cast-header">
          <h4>
            <Users2 size={14} /> {t("admin.movies.sectionCast")}
          </h4>
          <button
            type="button"
            className="btn-secondary admin-movie-form__add-cast"
            onClick={addCastRow}
          >
            <Plus size={14} /> {t("admin.movies.addActor")}
          </button>
        </div>
        <div className="admin-movie-form__cast-list">
          {cast.map((row, index) => (
            <div key={row.tempId} className="admin-movie-form__cast-row">
              <span className="admin-movie-form__cast-order">{index + 1}</span>
              <ActorSearchSelect
                value={row.actorId}
                displayName={row.actorName}
                onSelect={(actorId, actorName) =>
                  updateCastRow(row.tempId, { actorId, actorName })
                }
              />
              <input
                placeholder={t("admin.movies.characterNamePlaceholder")}
                value={row.characterName}
                onChange={(e) =>
                  updateCastRow(row.tempId, { characterName: e.target.value })
                }
              />
              <button
                type="button"
                className="admin-movie-form__remove-cast"
                onClick={() => removeCastRow(row.tempId)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {cast.length === 0 && (
            <p className="text-muted admin-movie-form__no-cast">
              {t("admin.movies.noCast")}
            </p>
          )}
        </div>
      </div>

      <div className="admin-movie-form__actions">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={mutation.isPending}
        >
          {isEditMode ? t("common.save") : t("common.add")}
        </button>
      </div>
    </form>
  );
}
