import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Image as ImageIcon, ListVideo } from "lucide-react";
import { listService } from "@/services";
import MovieSearchSelect from "./MovieSearchSelect";
import type { ListFormPayload } from "@/types";
import "./AdminMovieForm.css";

interface MovieRow {
  movieId: string;
  title: string;
  posterUrl: string;
}

interface Props {
  listId?: string;
  onDone: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM: Omit<ListFormPayload, "movieIds"> = {
  title: "",
  titleTr: "",
  description: "",
  coverImageUrl: "",
  displayOrder: 0,
};

export default function AdminListForm({ listId, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditMode = !!listId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [movies, setMovies] = useState<MovieRow[]>([]);

  const { data: existingList } = useQuery({
    queryKey: ["list", listId],
    queryFn: () => listService.getById(listId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!existingList) return;
    setForm({
      title: existingList.title,
      titleTr: existingList.titleTr,
      description: existingList.description,
      coverImageUrl: existingList.coverImageUrl,
      displayOrder: 0,
    });
    setMovies(
      existingList.movies.map((m) => ({
        movieId: m.id,
        title: m.title,
        posterUrl: m.posterUrl,
      })),
    );
  }, [existingList]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ListFormPayload = {
        ...form,
        movieIds: movies.map((m) => m.movieId),
      };
      return isEditMode
        ? listService.update(listId!, payload)
        : listService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["list-search-admin"] });
      if (isEditMode)
        queryClient.invalidateQueries({ queryKey: ["list", listId] });
      onDone();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const addMovie = (movieId: string, title: string, posterUrl: string) => {
    setMovies((prev) =>
      prev.some((m) => m.movieId === movieId)
        ? prev
        : [...prev, { movieId, title, posterUrl }],
    );
  };
  const removeMovie = (movieId: string) =>
    setMovies((prev) => prev.filter((m) => m.movieId !== movieId));

  return (
    <form className="admin-movie-form card" onSubmit={handleSubmit}>
      <h3>
        {isEditMode ? t("admin.lists.editTitle") : t("admin.lists.createTitle")}
      </h3>

      <div className="admin-movie-form__top">
        <div className="admin-movie-form__poster-preview">
          {form.coverImageUrl ? (
            <img src={form.coverImageUrl} alt="" />
          ) : (
            <ImageIcon size={22} className="text-muted" />
          )}
        </div>

        <div className="admin-movie-form__basic-fields">
          <div className="admin-movie-form__field">
            <label>{t("admin.lists.fieldTitleTr")}</label>
            <input
              value={form.titleTr}
              onChange={(e) => setForm({ ...form, titleTr: e.target.value })}
              required
            />
          </div>
          <div className="admin-movie-form__field">
            <label>{t("admin.lists.fieldTitle")}</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="admin-movie-form__field admin-movie-form__field--sm">
            <label>{t("admin.lists.fieldDisplayOrder")}</label>
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) =>
                setForm({ ...form, displayOrder: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </div>

      <div className="admin-movie-form__field">
        <label>{t("admin.lists.fieldCoverImageUrl")}</label>
        <input
          value={form.coverImageUrl}
          onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <div className="admin-movie-form__field">
        <label>{t("admin.lists.fieldDescription")}</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="admin-movie-form__section">
        <div className="admin-movie-form__cast-header">
          <h4>
            <ListVideo size={14} /> {t("admin.lists.sectionMovies")}
          </h4>
        </div>
        <MovieSearchSelect onSelect={addMovie} />
        <div className="admin-movie-form__cast-list" style={{ marginTop: 10 }}>
          {movies.map((m, index) => (
            <div key={m.movieId} className="admin-movie-form__cast-row">
              <span className="admin-movie-form__cast-order">{index + 1}</span>
              <span style={{ flex: 1 }}>{m.title}</span>
              <button
                type="button"
                className="admin-movie-form__remove-cast"
                onClick={() => removeMovie(m.movieId)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {movies.length === 0 && (
            <p className="text-muted admin-movie-form__no-cast">
              {t("admin.lists.noMovies")}
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
