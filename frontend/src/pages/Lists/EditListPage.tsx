import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type DragEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  X,
  Image as ImageIcon,
  ListVideo,
  Upload,
  Loader2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { listService, uploadService } from "@/services";
import MovieSearchSelect from "@/components/admin/MovieSearchSelect";
import { PageSpinner, PageError } from "@/components/common/PageState";
import type { ListFormPayload } from "@/types";
// Create sayfasıyla aynı stil dosyasını kullanıyoruz, class isimleri birebir aynı.
import "./CreateListPage.css";

interface MovieRow {
  movieId: string;
  title: string;
  posterUrl: string;
}

export default function EditListPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [form, setForm] = useState<
    Omit<ListFormPayload, "movieIds" | "isOfficial">
  >({
    title: "",
    titleTr: "",
    description: "",
    coverImageUrl: "",
    displayOrder: 0,
  });
  const [movies, setMovies] = useState<MovieRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPrefilled, setIsPrefilled] = useState(false);

  // Liste verisi gelince formu bir kere doldur (sonraki refetch'lerde kullanıcının
  // yaptığı değişiklikleri ezmemesi için isPrefilled ile koruyoruz).
  useEffect(() => {
    if (list && !isPrefilled) {
      setForm({
        title: list.title,
        titleTr: list.titleTr,
        description: list.description,
        coverImageUrl: list.coverImageUrl,
        displayOrder: 0,
      });
      setMovies(
        list.movies.map((m) => ({
          movieId: m.id,
          title: m.title,
          posterUrl: m.posterUrl,
        })),
      );
      setIsPrefilled(true);
    }
  }, [list, isPrefilled]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadService.uploadImage(file),
    onSuccess: (url) => setForm((f) => ({ ...f, coverImageUrl: url })),
    onError: () => setUploadError(t("admin.lists.uploadError")),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: ListFormPayload = {
        ...form,
        movieIds: movies.map((m) => m.movieId),
        // Backend artık bu alanı client'tan almıyor (rol bazlı server-side belirleniyor),
        // sadece tip uyumluluğu için dolduruyoruz.
        isOfficial: list?.isOfficial ?? false,
      };
      return listService.update(id!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      queryClient.invalidateQueries({ queryKey: ["list", id] });
      navigate(`/lists/${id}`);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
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

  const moveMovie = (index: number, direction: -1 | 1) => {
    setMovies((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

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

  if (isLoading) return <PageSpinner label={t("common.loading")} />;
  if (isError || !list)
    return (
      <PageError
        message={t("errors.listDetailFailed")}
        onRetry={() => refetch()}
      />
    );

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
        <h1>{t("lists.editList")}</h1>

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
                <div className="create-list-page__reorder-group">
                  <button
                    type="button"
                    className="create-list-page__reorder-btn"
                    onClick={() => moveMovie(index, -1)}
                    disabled={index === 0}
                    aria-label={t("admin.lists.moveUp")}
                    title={t("admin.lists.moveUp")}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="create-list-page__reorder-btn"
                    onClick={() => moveMovie(index, 1)}
                    disabled={index === movies.length - 1}
                    aria-label={t("admin.lists.moveDown")}
                    title={t("admin.lists.moveDown")}
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
                <button
                  type="button"
                  className="create-list-page__remove-movie"
                  onClick={() => removeMovie(m.movieId)}
                  aria-label={t("common.delete")}
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

        {updateMutation.isError && (
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
            disabled={updateMutation.isPending || uploadMutation.isPending}
          >
            {updateMutation.isPending && (
              <Loader2 size={14} className="create-list-page__spinner" />
            )}
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
