import { useState, useRef, type FormEvent, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, User, Upload, Loader2, ImageOff } from "lucide-react";
import { profileService, countryService } from "@/services";
import { useQuery } from "@tanstack/react-query";
import Dropdown from "@/components/search/Dropdown";
import type { ProfileData } from "@/types";
import "./EditProfileForm.css";

interface Props {
  userName: string;
  avatarUrl: string | null;
  fullName: string | null;
  country: string | null;
  birthDate: string | null;
  gender: ProfileData["gender"];
  biography: string | null;
  onClose: () => void;
}

const BIOGRAPHY_MAX_LENGTH = 500;

export default function EditProfileForm({
  userName,
  avatarUrl,
  fullName,
  country,
  birthDate,
  gender,
  biography,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(userName);
  const [avatar, setAvatar] = useState(avatarUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(avatarUrl ?? "");
  const [fullNameValue, setFullNameValue] = useState(fullName ?? "");
  const [countryValue, setCountryValue] = useState(country ?? "");
  const [birthDateValue, setBirthDateValue] = useState(
    birthDate ? birthDate.slice(0, 10) : "", // ISO string -> yyyy-MM-dd
  );
  const [genderValue, setGenderValue] = useState<ProfileData["gender"]>(gender);
  const [biographyValue, setBiographyValue] = useState(biography ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: countryService.getAll,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: (url) => {
      setAvatar(url);
    },
    onError: () => setError(t("profile.uploadError")),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      profileService.updateProfile({
        userName: name,
        avatarUrl: avatar.trim() || null,
        fullName: fullNameValue.trim() || null,
        country: countryValue || null,
        birthDate: birthDateValue || null,
        gender: genderValue,
        biography: biographyValue.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      onClose();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { title?: string } } })
        ?.response?.data?.title;
      setError(message ?? t("profile.updateError"));
    },
  });

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("profile.invalidImageType"));
      return;
    }
    setError(null);
    setPreviewUrl(URL.createObjectURL(file)); // anında önizleme, yükleme bitene kadar
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleRemoveAvatar = () => {
    setAvatar("");
    setPreviewUrl("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    saveMutation.mutate();
  };

  return (
    <div className="edit-profile-backdrop" onClick={onClose}>
      <form
        className="edit-profile-form"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="edit-profile-form__header">
          <div>
            <p className="edit-profile-form__eyebrow">{t("profile.member")}</p>
            <h3>{t("profile.editProfile")}</h3>
          </div>
          <button
            type="button"
            className="edit-profile-form__close"
            onClick={onClose}
            aria-label={t("common.cancel")}
          >
            <X size={16} />
          </button>
        </div>

        {error && <p className="edit-profile-form__error">{error}</p>}

        <div
          className={`edit-profile-form__dropzone ${isDragging ? "is-dragging" : ""}`}
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

          <div className="edit-profile-form__avatar-preview">
            {uploadMutation.isPending ? (
              <Loader2 size={22} className="edit-profile-form__spinner" />
            ) : previewUrl ? (
              <img src={previewUrl} alt="" />
            ) : (
              <span>{name[0]?.toUpperCase()}</span>
            )}
          </div>

          <p className="edit-profile-form__dropzone-text">
            <Upload size={13} />{" "}
            {isDragging ? t("profile.dropHere") : t("profile.dragOrClick")}
          </p>

          {previewUrl && !uploadMutation.isPending && (
            <button
              type="button"
              className="edit-profile-form__remove-avatar"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveAvatar();
              }}
            >
              <ImageOff size={12} /> {t("profile.removeAvatar")}
            </button>
          )}
        </div>

        <div className="edit-profile-form__field">
          <label>
            <User size={13} /> {t("profile.displayName")}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={3}
            maxLength={50}
            required
          />
        </div>

        <div className="edit-profile-form__field">
          <label>{t("profile.fullName")}</label>
          <input
            value={fullNameValue}
            onChange={(e) => setFullNameValue(e.target.value)}
            maxLength={100}
            placeholder={t("profile.fullNamePlaceholder")}
          />
        </div>

        <div className="edit-profile-form__field">
          <label>{t("profile.country")}</label>
          <Dropdown
            value={countryValue}
            onChange={setCountryValue}
            options={[
              { label: t("profile.countryNotSpecified"), value: "" },
              ...(countries?.map((c) => ({
                label: i18n.language === "tr" ? c.nameTr : c.name,
                value: i18n.language === "tr" ? c.nameTr : c.name,
              })) ?? []),
            ]}
          />
        </div>

        <div className="edit-profile-form__field">
          <label>{t("profile.birthDate")}</label>
          <input
            type="date"
            value={birthDateValue}
            onChange={(e) => setBirthDateValue(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="edit-profile-form__field">
          <label>{t("profile.gender")}</label>
          <Dropdown
            value={genderValue}
            onChange={(v) => setGenderValue(v as ProfileData["gender"])}
            options={[
              { label: t("profile.genderNotSpecified"), value: "NotSpecified" },
              { label: t("profile.genderMale"), value: "Male" },
              { label: t("profile.genderFemale"), value: "Female" },
            ]}
          />
        </div>

        <div className="edit-profile-form__field">
          <label>
            {t("profile.biography")}{" "}
            <span className="edit-profile-form__char-count">
              {biographyValue.length}/{BIOGRAPHY_MAX_LENGTH}
            </span>
          </label>
          <textarea
            value={biographyValue}
            onChange={(e) => setBiographyValue(e.target.value)}
            maxLength={BIOGRAPHY_MAX_LENGTH}
            rows={4}
            placeholder={t("profile.biographyPlaceholder")}
          />
        </div>

        <div className="edit-profile-form__actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saveMutation.isPending || uploadMutation.isPending}
          >
            {saveMutation.isPending && (
              <Loader2 size={14} className="edit-profile-form__spinner" />
            )}
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
