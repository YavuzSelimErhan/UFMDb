import { useState, useRef, type FormEvent, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  X,
  Image as ImageIcon,
  ListVideo,
  Upload,
  Loader2,
} from "lucide-react";
import { listService, uploadService } from "@/services";
// NOT: gerçek yol farklıysa (AdminListForm.tsx'in bulunduğu klasöre göre) sadece bu satırı düzelt.
import MovieSearchSelect from "@/components/admin/MovieSearchSelect";
import type { ListFormPayload } from "@/types";
import "./CreateListPage.css";

interface MovieRow {
  movieId: string;
  title: string;
  posterUrl: string;
}

const EMPTY_FORM: Omit<ListFormPayload, "movieIds" | "isOfficial"> = {
  title: "",
  titleTr: "",
  description: "",
  coverImageUrl: "",
  displayOrder: 0,
};

export default function CreateListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [movies, setMovies] = useState<MovieRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadService.uploadImage(file),
    onSuccess: (url) => setForm((f) => ({ ...f, coverImageUrl: url })),
    onError: () => setUploadError(t("admin.lists.uploadError")),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: ListFormPayload = {
        ...form,
        movieIds: movies.map((m) => m.movieId),
        isOfficial: false,
      };
      return listService.create(payload);
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      navigate(`/lists/${id}`);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
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

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError(t("admin.lists.invalidImageType"));
      return;
    }
    setUploadError(null);
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="container create-list-page">
      <button
        type="button"
        className="create-list-page__back"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <form className="create-list-page__form card" onSubmit={handleSubmit}>
        <h1>{t("lists.createList")}</h1>

        <div className="create-list-page__top">
          <div
            className={`create-list-page__cover ${isDragging ? "is-dragging" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {uploadMutation.isPending ? (
              <Loader2 size={22} className="create-list-page__spinner" />
            ) : form.coverImageUrl ? (
              <img src={form.coverImageUrl} alt="" />
            ) : (
              <div className="create-list-page__cover-empty">
                <ImageIcon size={20} />
                <span>
                  <Upload size={11} />{" "}
                  {isDragging
                    ? t("admin.lists.dropHere")
                    : t("admin.lists.dragOrClick")}
                </span>
              </div>
            )}
          </div>

          <div className="create-list-page__fields">
            <div className="create-list-page__field">
              <label>{t("admin.lists.fieldTitleTr")}</label>
              <input
                value={form.titleTr}
                onChange={(e) => setForm({ ...form, titleTr: e.target.value })}
                required
              />
            </div>
            <div className="create-list-page__field">
              <label>{t("admin.lists.fieldTitle")}</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        <div className="create-list-page__field">
          <label>{t("admin.lists.fieldCoverImageUrl")}</label>
          <input
            value={form.coverImageUrl}
            onChange={(e) =>
              setForm({ ...form, coverImageUrl: e.target.value })
            }
            placeholder="https://..."
          />
          <p className="create-list-page__hint">{t("admin.lists.coverHint")}</p>
        </div>

        {uploadError && (
          <p className="create-list-page__error">{uploadError}</p>
        )}

        <div className="create-list-page__field">
          <label>{t("admin.lists.fieldDescription")}</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="create-list-page__section">
          <h2>
            <ListVideo size={15} /> {t("admin.lists.sectionMovies")}
          </h2>
          <MovieSearchSelect onSelect={addMovie} />
          <div className="create-list-page__movie-list">
            {movies.map((m, index) => (
              <div key={m.movieId} className="create-list-page__movie-row">
                <span className="create-list-page__movie-order">
                  {index + 1}
                </span>
                <span style={{ flex: 1 }}>{m.title}</span>
                <button
                  type="button"
                  className="create-list-page__remove-movie"
                  onClick={() => removeMovie(m.movieId)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {movies.length === 0 && (
              <p className="text-muted create-list-page__no-movies">
                {t("admin.lists.noMovies")}
              </p>
            )}
          </div>
        </div>

        {createMutation.isError && (
          <p className="create-list-page__error">
            {t("admin.lists.saveError")}
          </p>
        )}

        <div className="create-list-page__actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={createMutation.isPending || uploadMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 size={14} className="create-list-page__spinner" />
            )}
            {t("common.add")}
          </button>
        </div>
      </form>
    </div>
  );
}
