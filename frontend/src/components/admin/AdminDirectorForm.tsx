import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { directorService } from "@/services";
import type { DirectorFormPayload } from "@/types";
import "./AdminActorForm.css";

interface Props {
  directorId?: string;
  onDone: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM: DirectorFormPayload = {
  fullName: "",
  birthDate: null,
  biography: "",
  photoUrl: "",
  nationality: "",
};

export default function AdminDirectorForm({
  directorId,
  onDone,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditMode = !!directorId;

  const [form, setForm] = useState<DirectorFormPayload>(EMPTY_FORM);

  const { data: existingDirector } = useQuery({
    queryKey: ["director", directorId],
    queryFn: () => directorService.getById(directorId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!existingDirector) return;
    setForm({
      fullName: existingDirector.fullName,
      birthDate: existingDirector.birthDate
        ? existingDirector.birthDate.slice(0, 10)
        : null,
      biography: existingDirector.biography,
      photoUrl: existingDirector.photoUrl,
      nationality: existingDirector.nationality,
    });
  }, [existingDirector]);

  const mutation = useMutation({
    mutationFn: () =>
      isEditMode
        ? directorService.update(directorId!, form)
        : directorService.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["director-search-admin"] });
      if (isEditMode)
        queryClient.invalidateQueries({ queryKey: ["director", directorId] });
      onDone();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form className="admin-actor-form card" onSubmit={handleSubmit}>
      <h3>
        {isEditMode
          ? t("admin.directors.editTitle")
          : t("admin.directors.createTitle")}
      </h3>

      <div className="admin-actor-form__layout">
        <div className="admin-actor-form__photo-col">
          <div className="admin-actor-form__photo-preview">
            {form.photoUrl ? (
              <img src={form.photoUrl} alt="" />
            ) : (
              <span>{t("admin.personForm.noPhoto")}</span>
            )}
          </div>
          <label>{t("admin.personForm.photoUrl")}</label>
          <input
            placeholder="https://..."
            value={form.photoUrl}
            onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
          />
        </div>

        <div className="admin-actor-form__fields-col">
          <label>{t("admin.personForm.fullName")}</label>
          <input
            placeholder={t("admin.directors.namePlaceholder")}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />

          <div className="admin-actor-form__row">
            <div>
              <label>{t("admin.personForm.nationality")}</label>
              <input
                placeholder={t("admin.directors.nationalityPlaceholder")}
                value={form.nationality}
                onChange={(e) =>
                  setForm({ ...form, nationality: e.target.value })
                }
              />
            </div>
            <div>
              <label>{t("admin.personForm.birthDate")}</label>
              <input
                type="date"
                value={form.birthDate ?? ""}
                onChange={(e) =>
                  setForm({ ...form, birthDate: e.target.value || null })
                }
              />
            </div>
          </div>

          <label>{t("admin.personForm.biography")}</label>
          <textarea
            placeholder={t("admin.personForm.biographyPlaceholder")}
            value={form.biography}
            onChange={(e) => setForm({ ...form, biography: e.target.value })}
            rows={4}
          />
        </div>
      </div>

      <div className="admin-actor-form__actions">
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
