import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { personService } from "@/services";
import type { PersonFormPayload } from "@/types";
import "./AdminPersonForm.css";

interface Props {
  personId?: string;
  onDone: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM: PersonFormPayload = {
  fullName: "",
  birthDate: null,
  biography: "",
  photoUrl: "",
  nationality: "",
};

export default function AdminPersonForm({ personId, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditMode = !!personId;

  const [form, setForm] = useState<PersonFormPayload>(EMPTY_FORM);

  const { data: existingPerson } = useQuery({
    queryKey: ["person-admin", personId],
    queryFn: () => personService.getById(personId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!existingPerson) return;
    setForm({
      fullName: existingPerson.fullName,
      birthDate: existingPerson.birthDate
        ? existingPerson.birthDate.slice(0, 10)
        : null,
      biography: existingPerson.biography,
      photoUrl: existingPerson.photoUrl,
      nationality: existingPerson.nationality,
    });
  }, [existingPerson]);

  const mutation = useMutation({
    mutationFn: () =>
      isEditMode
        ? personService.update(personId!, form)
        : personService.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people-search-admin"] });
      queryClient.invalidateQueries({ queryKey: ["people-search"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["person-admin", personId] });
        // Kişi sayfasının tüm dil varyantları
        queryClient.invalidateQueries({ queryKey: ["person", personId] });
      }
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
          ? t("admin.people.editTitle", "Kişiyi düzenle")
          : t("admin.people.createTitle", "Yeni kişi ekle")}
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
            placeholder={t("admin.people.namePlaceholder", "Ad Soyad")}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />

          <div className="admin-actor-form__row">
            <div>
              <label>{t("admin.personForm.nationality")}</label>
              <input
                placeholder={t(
                  "admin.people.nationalityPlaceholder",
                  "Örn. Türkiye",
                )}
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
