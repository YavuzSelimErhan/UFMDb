import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Film,
  Globe,
  GripVertical,
  Image as ImageIcon,
  Link2,
  ListOrdered,
  Loader2,
  Lock,
  StickyNote,
  Upload,
  X,
} from "lucide-react";
import { uploadService } from "@/services";
import { useAppSelector } from "@/store";
import MovieSearchSelect from "@/components/admin/MovieSearchSelect";
import { pickListText } from "@/utils/listText";
import type { ListFormPayload, ListStatus, ListVisibility } from "@/types";
import "./ListForm.css";

const MAX_ITEMS = 500;
// true yaparsan sıradan kullanıcılar da kapak görseli yükleyebilir.
const ALLOW_USER_COVER = false;

export interface FormMovie {
  movieId: string;
  title: string;
  posterUrl: string;
  note: string;
  noteTr: string;
}

export interface ListFormValues {
  title: string;
  titleTr: string;
  description: string;
  descriptionTr: string;
  coverImageUrl: string;
  displayOrder: number;
  isRanked: boolean;
  visibility: ListVisibility;
  status: ListStatus;
  isOfficial: boolean;
  movies: FormMovie[];
}

export const EMPTY_LIST_FORM: ListFormValues = {
  title: "",
  titleTr: "",
  description: "",
  descriptionTr: "",
  coverImageUrl: "",
  displayOrder: 0,
  isRanked: false,
  visibility: "Public",
  status: "Published",
  isOfficial: false,
  movies: [],
};

interface Props {
  mode: "create" | "edit";
  initial: ListFormValues;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: (payload: ListFormPayload) => void;
}

type Lang = "tr" | "en";

function errorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const d = err.response?.data;
    if (d?.errors && typeof d.errors === "object") {
      const msgs = Object.values(
        d.errors as Record<string, string[] | string>,
      ).flat();
      if (msgs.length) return msgs.join(" ");
    }
    if (typeof d?.message === "string") return d.message;
    if (typeof d?.detail === "string") return d.detail;
  }
  return fallback;
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <span className="list-form__switch">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="list-form__switch-track" />
    </span>
  );
}

export default function ListForm({
  mode,
  initial,
  isSubmitting,
  error,
  onSubmit,
}: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAdmin = useAppSelector((s) => s.auth.role) === "Admin";
  const allowCover = isAdmin || ALLOW_USER_COVER;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { movies: initialMovies, ...initialForm } = initial;
  const [form, setForm] = useState(initialForm);
  const [movies, setMovies] = useState<FormMovie[]>(initialMovies);
  const [lang, setLang] = useState<Lang>(
    i18n.language.startsWith("tr") ? "tr" : "en",
  );
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isCoverDragging, setIsCoverDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Kaydedilmemiş değişiklik takibi
  const initialSnap = useRef(
    JSON.stringify({ ...initialForm, movies: initialMovies }),
  );
  const dirty = JSON.stringify({ ...form, movies }) !== initialSnap.current;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const titleValue = lang === "tr" ? form.titleTr : form.title;
  const descValue = lang === "tr" ? form.descriptionTr : form.description;
  const setTitle = (v: string) =>
    setForm((f) => (lang === "tr" ? { ...f, titleTr: v } : { ...f, title: v }));
  const setDesc = (v: string) =>
    setForm((f) =>
      lang === "tr" ? { ...f, descriptionTr: v } : { ...f, description: v },
    );

  // ---------- Filmler ----------
  const addMovie = (movieId: string, title: string, posterUrl: string) => {
    setMovies((prev) =>
      prev.length >= MAX_ITEMS || prev.some((m) => m.movieId === movieId)
        ? prev
        : [...prev, { movieId, title, posterUrl, note: "", noteTr: "" }],
    );
  };
  const removeMovie = (movieId: string) =>
    setMovies((prev) => prev.filter((m) => m.movieId !== movieId));
  const moveMovie = (index: number, dir: -1 | 1) => reorder(index, index + dir);
  const reorder = (from: number, to: number) =>
    setMovies((prev) => {
      if (from === to || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  const setNote = (movieId: string, value: string) =>
    setMovies((prev) =>
      prev.map((m) =>
        m.movieId !== movieId
          ? m
          : lang === "tr"
            ? { ...m, noteTr: value }
            : { ...m, note: value },
      ),
    );
  const toggleNote = (movieId: string) =>
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  const resetDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  // ---------- Kapak ----------
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadService.uploadImage(file),
    onSuccess: (url) => patch({ coverImageUrl: url }),
    onError: () => setUploadError(t("admin.lists.uploadError")),
  });
  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError(t("admin.lists.invalidImageType"));
      return;
    }
    setUploadError(null);
    uploadMutation.mutate(file);
  };
  const handleCoverDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsCoverDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  // ---------- Gönderim ----------
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const title = form.title.trim() || form.titleTr.trim();
    if (!title) {
      setLocalError(t("lists.form.titleRequired"));
      return;
    }
    setLocalError(null);
    const description = form.description.trim() || form.descriptionTr.trim();
    onSubmit({
      title,
      titleTr: form.titleTr.trim() || title,
      description,
      descriptionTr: form.descriptionTr.trim() || description,
      coverImageUrl: allowCover ? form.coverImageUrl.trim() : "",
      displayOrder: form.isOfficial ? form.displayOrder : 0,
      isRanked: form.isRanked,
      visibility: form.isOfficial ? "Public" : form.visibility,
      status: form.status,
      isOfficial: form.isOfficial,
      items: movies.map((m) => ({
        movieId: m.movieId,
        note: m.note.trim() || null,
        noteTr: m.noteTr.trim() || null,
      })),
    });
  };

  // ---------- Önizleme verisi ----------
  const previewTitle = pickListText(form.titleTr, form.title, i18n.language);
  const posters = movies
    .map((m) => m.posterUrl)
    .filter(Boolean)
    .slice(0, 4);
  const cover = allowCover ? form.coverImageUrl : "";

  const visibilityOptions: {
    key: ListVisibility;
    icon: ReactNode;
    label: string;
    desc: string;
  }[] = [
    {
      key: "Public",
      icon: <Globe size={16} />,
      label: t("lists.form.visPublic"),
      desc: t("lists.form.visPublicDesc"),
    },
    {
      key: "Unlisted",
      icon: <Link2 size={16} />,
      label: t("lists.form.visUnlisted"),
      desc: t("lists.form.visUnlistedDesc"),
    },
    {
      key: "Private",
      icon: <Lock size={16} />,
      label: t("lists.form.visPrivate"),
      desc: t("lists.form.visPrivateDesc"),
    },
  ];

  const statusOptions: { key: ListStatus; label: string }[] = [
    { key: "Published", label: t("lists.form.statusPublished") },
    { key: "Draft", label: t("lists.form.statusDraft") },
    ...(initial.status === "Archived"
      ? [
          {
            key: "Archived" as ListStatus,
            label: t("lists.form.statusArchived"),
          },
        ]
      : []),
  ];

  const submitLabel =
    mode === "edit"
      ? t("common.save")
      : form.status === "Draft"
        ? t("lists.form.saveDraft")
        : t("lists.form.publish");

  const shownError =
    localError ??
    (error ? errorMessage(error, t("admin.lists.saveError")) : null);

  return (
    <div className="container list-form-page">
      <button
        type="button"
        className="list-form-page__back"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <form className="list-form" onSubmit={handleSubmit}>
        <header className="list-form__head">
          <h1>
            {mode === "create" ? t("lists.createList") : t("lists.editList")}
          </h1>
          <div
            className="list-form__lang"
            role="group"
            aria-label={t("lists.form.contentLang")}
          >
            {(["tr", "en"] as const).map((l) => {
              const missing =
                l === "tr" ? !form.titleTr.trim() : !form.title.trim();
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  className={lang === l ? "is-active" : ""}
                  onClick={() => setLang(l)}
                  title={missing ? t("lists.form.otherLangMissing") : undefined}
                >
                  {l.toUpperCase()}
                  {missing && <span className="list-form__lang-dot" />}
                </button>
              );
            })}
          </div>
        </header>

        <div className="list-form__layout">
          {/* ===================== Sol: içerik ===================== */}
          <div className="list-form__main">
            <section className="list-form__panel card">
              <div className="list-form__field">
                <label htmlFor="list-title">
                  {t("lists.form.title")} ({lang.toUpperCase()})
                </label>
                <input
                  id="list-title"
                  value={titleValue}
                  maxLength={200}
                  placeholder={t("lists.form.titlePlaceholder")}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="list-form__field">
                <label htmlFor="list-desc">
                  {t("lists.form.description")} ({lang.toUpperCase()})
                </label>
                <textarea
                  id="list-desc"
                  rows={3}
                  value={descValue}
                  maxLength={2000}
                  placeholder={t("lists.form.descriptionPlaceholder")}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>
              <p className="list-form__hint">{t("lists.form.fallbackHint")}</p>
            </section>

            <section className="list-form__panel card">
              <div className="list-form__panel-head">
                <h2>
                  <Film size={16} /> {t("lists.form.films")}
                </h2>
                <span className="list-form__count">
                  {movies.length} / {MAX_ITEMS}
                </span>
              </div>

              <MovieSearchSelect onSelect={addMovie} />

              {movies.length === 0 ? (
                <div className="list-form__movies-empty">
                  <Film size={26} />
                  <p>{t("lists.form.filmsEmpty")}</p>
                </div>
              ) : (
                <ol className="list-form__movies">
                  {movies.map((m, index) => {
                    const noteOpen = openNotes.has(m.movieId);
                    const noteValue = lang === "tr" ? m.noteTr : m.note;
                    const hasNote = !!(m.note.trim() || m.noteTr.trim());
                    return (
                      <li
                        key={m.movieId}
                        className={[
                          "list-form__movie",
                          dragIndex === index ? "is-dragging" : "",
                          overIndex === index &&
                          dragIndex !== null &&
                          dragIndex !== index
                            ? "is-over"
                            : "",
                        ].join(" ")}
                        onDragOver={(e) => {
                          if (dragIndex === null) return;
                          e.preventDefault();
                          setOverIndex(index);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null) reorder(dragIndex, index);
                          resetDrag();
                        }}
                      >
                        <div className="list-form__movie-main">
                          <span
                            className="list-form__handle"
                            draggable
                            title={t("lists.form.dragHint")}
                            onDragStart={(e) => {
                              setDragIndex(index);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", m.movieId);
                              const row = e.currentTarget.closest("li");
                              if (row) e.dataTransfer.setDragImage(row, 16, 16);
                            }}
                            onDragEnd={resetDrag}
                          >
                            <GripVertical size={16} />
                          </span>
                          {form.isRanked && (
                            <span className="list-form__movie-rank">
                              {index + 1}
                            </span>
                          )}
                          {m.posterUrl ? (
                            <img
                              src={m.posterUrl}
                              alt=""
                              className="list-form__thumb"
                            />
                          ) : (
                            <span className="list-form__thumb list-form__thumb--empty">
                              <Film size={14} />
                            </span>
                          )}
                          <span className="list-form__movie-title">
                            {m.title}
                          </span>
                          <div className="list-form__movie-actions">
                            <button
                              type="button"
                              className={`list-form__icon-btn ${hasNote ? "has-note" : ""}`}
                              aria-pressed={noteOpen}
                              title={
                                hasNote
                                  ? t("lists.form.editNote")
                                  : t("lists.form.addNote")
                              }
                              aria-label={
                                hasNote
                                  ? t("lists.form.editNote")
                                  : t("lists.form.addNote")
                              }
                              onClick={() => toggleNote(m.movieId)}
                            >
                              <StickyNote size={14} />
                            </button>
                            <button
                              type="button"
                              className="list-form__icon-btn"
                              disabled={index === 0}
                              title={t("admin.lists.moveUp")}
                              aria-label={t("admin.lists.moveUp")}
                              onClick={() => moveMovie(index, -1)}
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="list-form__icon-btn"
                              disabled={index === movies.length - 1}
                              title={t("admin.lists.moveDown")}
                              aria-label={t("admin.lists.moveDown")}
                              onClick={() => moveMovie(index, 1)}
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              className="list-form__icon-btn list-form__icon-btn--danger"
                              title={t("common.delete")}
                              aria-label={t("common.delete")}
                              onClick={() => removeMovie(m.movieId)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                        {noteOpen && (
                          <textarea
                            className="list-form__note"
                            rows={2}
                            maxLength={1000}
                            value={noteValue}
                            placeholder={`${t("lists.form.notePlaceholder")} (${lang.toUpperCase()})`}
                            onChange={(e) => setNote(m.movieId, e.target.value)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              {form.status === "Published" && movies.length === 0 && (
                <p className="list-form__hint">
                  {t("lists.form.notDiscoverableHint")}
                </p>
              )}
            </section>
          </div>

          {/* ===================== Sağ: ayarlar ===================== */}
          <aside className="list-form__side">
            <section className="list-form__panel card">
              <h2 className="list-form__side-title">
                {t("lists.form.preview")}
              </h2>
              <div className="list-form__preview">
                <div className="list-form__preview-stage">
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      className="list-form__preview-cover"
                    />
                  ) : posters.length > 0 ? (
                    <div className="list-form__fan">
                      {posters.map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt=""
                          className="list-form__fan-poster"
                        />
                      ))}
                    </div>
                  ) : (
                    <Film size={28} className="list-form__preview-empty" />
                  )}
                  {form.isRanked && (
                    <span className="list-form__preview-badge">
                      <ListOrdered size={11} /> {t("lists.ranked")}
                    </span>
                  )}
                </div>
                <div className="list-form__preview-body">
                  <strong>{previewTitle || t("lists.form.untitled")}</strong>
                  <span className="list-form__preview-ticket">
                    {movies.length} {t("lists.moviesCount")}
                  </span>
                </div>
              </div>
            </section>

            {!form.isOfficial && (
              <section className="list-form__panel card">
                <h2 className="list-form__side-title">
                  {t("lists.form.visibility")}
                </h2>
                <div className="list-form__radio-group" role="radiogroup">
                  {visibilityOptions.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={form.visibility === o.key}
                      className={`list-form__radio ${form.visibility === o.key ? "is-active" : ""}`}
                      onClick={() => patch({ visibility: o.key })}
                    >
                      <span className="list-form__radio-icon">{o.icon}</span>
                      <span>
                        <strong>{o.label}</strong>
                        <small>{o.desc}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="list-form__panel card">
              <h2 className="list-form__side-title">
                {t("lists.form.options")}
              </h2>
              <div className="list-form__option">
                <div>
                  <strong>{t("lists.form.ranked")}</strong>
                  <small>{t("lists.form.rankedDesc")}</small>
                </div>
                <Switch
                  checked={form.isRanked}
                  onChange={(v) => patch({ isRanked: v })}
                  label={t("lists.form.ranked")}
                />
              </div>

              <div className="list-form__field">
                <label>{t("lists.form.status")}</label>
                <div className="list-form__segmented" role="radiogroup">
                  {statusOptions.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={form.status === o.key}
                      className={form.status === o.key ? "is-active" : ""}
                      onClick={() => patch({ status: o.key })}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {form.status !== "Published" && (
                  <p className="list-form__hint">{t("lists.form.draftHint")}</p>
                )}
              </div>
            </section>

            {isAdmin && (
              <section className="list-form__panel card">
                <h2 className="list-form__side-title">Admin</h2>
                <div className="list-form__option">
                  <div>
                    <strong>{t("lists.form.official")}</strong>
                    <small>{t("lists.form.officialDesc")}</small>
                  </div>
                  <Switch
                    checked={form.isOfficial}
                    disabled={mode === "edit"}
                    onChange={(v) => patch({ isOfficial: v })}
                    label={t("lists.form.official")}
                  />
                </div>
                {form.isOfficial && (
                  <div className="list-form__field">
                    <label htmlFor="list-order">
                      {t("lists.form.displayOrder")}
                    </label>
                    <input
                      id="list-order"
                      type="number"
                      value={form.displayOrder}
                      onChange={(e) =>
                        patch({ displayOrder: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                )}
              </section>
            )}

            <section className="list-form__panel card">
              <h2 className="list-form__side-title">{t("lists.form.cover")}</h2>
              {allowCover ? (
                <>
                  <div
                    className={`list-form__cover ${isCoverDragging ? "is-dragging" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsCoverDragging(true);
                    }}
                    onDragLeave={() => setIsCoverDragging(false)}
                    onDrop={handleCoverDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                    {uploadMutation.isPending ? (
                      <Loader2 size={22} className="list-form__spinner" />
                    ) : form.coverImageUrl ? (
                      <>
                        <img src={form.coverImageUrl} alt="" />
                        <button
                          type="button"
                          className="list-form__cover-remove"
                          aria-label={t("common.delete")}
                          onClick={(e) => {
                            e.stopPropagation();
                            patch({ coverImageUrl: "" });
                          }}
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="list-form__cover-empty">
                        <ImageIcon size={20} />
                        <span>
                          <Upload size={11} />{" "}
                          {isCoverDragging
                            ? t("admin.lists.dropHere")
                            : t("admin.lists.dragOrClick")}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="list-form__field">
                    <label htmlFor="list-cover-url">
                      {t("lists.form.coverUrl")}
                    </label>
                    <input
                      id="list-cover-url"
                      value={form.coverImageUrl}
                      placeholder="https://..."
                      onChange={(e) => patch({ coverImageUrl: e.target.value })}
                    />
                  </div>
                  {uploadError && (
                    <p className="list-form__error">{uploadError}</p>
                  )}
                  <p className="list-form__hint">
                    {t("lists.form.coverAutoIfEmpty")}
                  </p>
                </>
              ) : (
                <p className="list-form__hint">{t("lists.form.coverAuto")}</p>
              )}
            </section>
          </aside>
        </div>

        {/* ===================== Alt aksiyon çubuğu ===================== */}
        <div className="list-form__bar">
          <span className="list-form__bar-status">
            {shownError ? (
              <span className="list-form__error">{shownError}</span>
            ) : dirty ? (
              t("lists.form.unsaved")
            ) : null}
          </span>
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
            disabled={isSubmitting || uploadMutation.isPending}
          >
            {isSubmitting && (
              <Loader2 size={14} className="list-form__spinner" />
            )}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
