import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { actorService } from "@/services";
import type { ActorFormPayload } from "@/types";
import "./AdminActorForm.css";

interface Props {
  actorId?: string;
  onDone: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM: ActorFormPayload = {
  fullName: "",
  birthDate: null,
  biography: "",
  photoUrl: "",
  nationality: "",
};

export default function AdminActorForm({ actorId, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditMode = !!actorId;

  const [form, setForm] = useState<ActorFormPayload>(EMPTY_FORM);

  const { data: existingActor } = useQuery({
    queryKey: ["actor", actorId],
    queryFn: () => actorService.getById(actorId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!existingActor) return;
    setForm({
      fullName: existingActor.fullName,
      birthDate: existingActor.birthDate
        ? existingActor.birthDate.slice(0, 10)
        : null,
      biography: existingActor.biography,
      photoUrl: existingActor.photoUrl,
      nationality: existingActor.nationality,
    });
  }, [existingActor]);

  const mutation = useMutation({
    mutationFn: () =>
      isEditMode
        ? actorService.update(actorId!, form)
        : actorService.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actor-search-admin"] });
      if (isEditMode)
        queryClient.invalidateQueries({ queryKey: ["actor", actorId] });
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
          ? t("admin.actors.editTitle")
          : t("admin.actors.createTitle")}
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
            placeholder={t("admin.actors.namePlaceholder")}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />

          <div className="admin-actor-form__row">
            <div>
              <label>{t("admin.personForm.nationality")}</label>
              <input
                placeholder={t("admin.actors.nationalityPlaceholder")}
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
