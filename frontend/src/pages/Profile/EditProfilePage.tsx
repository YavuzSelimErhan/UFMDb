import { useState, useRef, type FormEvent, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Upload,
  Loader2,
  ImageOff,
  Clapperboard,
} from "lucide-react";
import { profileService, countryService } from "@/services";
import Dropdown from "@/components/search/Dropdown";
import { PageSpinner, PageError } from "@/components/common/PageState";
import type { ProfileData } from "@/types";
import "./EditProfilePage.css";

const BIOGRAPHY_MAX_LENGTH = 500;

export default function EditProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["my-profile"],
    queryFn: profileService.getMyProfile,
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: countryService.getAll,
  });

  if (isLoading || !profile) return <PageSpinner label={t("common.loading")} />;
  if (isError)
    return (
      <PageError
        message={t("errors.profileFailed")}
        onRetry={() => refetch()}
      />
    );

  return (
    <EditProfileFormBody
      profile={profile}
      countries={countries}
      language={i18n.language}
      onDone={() => {
        queryClient.invalidateQueries({ queryKey: ["my-profile"] });
        navigate("/profile");
      }}
      onCancel={() => navigate("/profile")}
    />
  );
}

function EditProfileFormBody({
  profile,
  countries,
  language,
  onDone,
  onCancel,
}: {
  profile: ProfileData;
  countries?: { name: string; nameTr: string }[];
  language: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile.userName);
  const [avatar, setAvatar] = useState(profile.avatarUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(profile.avatarUrl ?? "");
  const [fullNameValue, setFullNameValue] = useState(profile.fullName ?? "");
  const [countryValue, setCountryValue] = useState(profile.country ?? "");
  const [birthDateValue, setBirthDateValue] = useState(
    profile.birthDate ? profile.birthDate.slice(0, 10) : "",
  );
  const [genderValue, setGenderValue] = useState<ProfileData["gender"]>(
    profile.gender,
  );
  const [biographyValue, setBiographyValue] = useState(profile.biography ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: (url) => setAvatar(url),
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
    onSuccess: onDone,
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
    setPreviewUrl(URL.createObjectURL(file));
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
    <div className="container edit-profile-page">
      <button
        type="button"
        className="edit-profile-page__back"
        onClick={onCancel}
      >
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <form className="edit-profile-shell" onSubmit={handleSubmit}>
        {/* ---------- Sol panel: kimlik kartı ---------- */}
        <div className="edit-profile-pass" aria-hidden="true">
          <div className="edit-profile-pass__glow" />

          <div className="edit-profile-pass__eyebrow">
            <Clapperboard size={13} /> {t("profile.member")}
          </div>

          <div
            className={`edit-profile-pass__dropzone ${isDragging ? "is-dragging" : ""}`}
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
            <div className="edit-profile-pass__avatar">
              {uploadMutation.isPending ? (
                <Loader2 size={24} className="edit-profile-page__spinner" />
              ) : previewUrl ? (
                <img src={previewUrl} alt="" />
              ) : (
                <span>{name[0]?.toUpperCase()}</span>
              )}
            </div>
            <p className="edit-profile-pass__dropzone-text">
              <Upload size={12} />{" "}
              {isDragging ? t("profile.dropHere") : t("profile.dragOrClick")}
            </p>
          </div>

          {previewUrl && !uploadMutation.isPending && (
            <button
              type="button"
              className="edit-profile-pass__remove-avatar"
              onClick={handleRemoveAvatar}
            >
              <ImageOff size={12} /> {t("profile.removeAvatar")}
            </button>
          )}

          <p className="edit-profile-pass__name">{fullNameValue || name}</p>
          <p className="edit-profile-pass__handle">@{name}</p>

          <div className="edit-profile-pass__perf" />
        </div>

        {/* ---------- Sağ panel: form alanları ---------- */}
        <div className="edit-profile-fields">
          {error && <p className="edit-profile-page__error">{error}</p>}

          <section className="edit-profile-section">
            <p className="edit-profile-section__label">
              {t("profile.tabProfile")}
            </p>

            <div className="edit-profile-page__field">
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

            <div className="edit-profile-page__field">
              <label>{t("profile.fullName")}</label>
              <input
                value={fullNameValue}
                onChange={(e) => setFullNameValue(e.target.value)}
                maxLength={100}
                placeholder={t("profile.fullNamePlaceholder")}
              />
            </div>
          </section>

          <section className="edit-profile-section">
            <p className="edit-profile-section__label">
              {t("profile.country")} · {t("profile.gender")}
            </p>

            <div className="edit-profile-page__row">
              <div className="edit-profile-page__field">
                <label>{t("profile.country")}</label>
                <Dropdown
                  value={countryValue}
                  onChange={setCountryValue}
                  options={[
                    { label: t("profile.countryNotSpecified"), value: "" },
                    ...(countries?.map((c) => ({
                      label: language === "tr" ? c.nameTr : c.name,
                      value: language === "tr" ? c.nameTr : c.name,
                    })) ?? []),
                  ]}
                />
              </div>

              <div className="edit-profile-page__field">
                <label>{t("profile.gender")}</label>
                <Dropdown
                  value={genderValue}
                  onChange={(v) => setGenderValue(v as ProfileData["gender"])}
                  options={[
                    {
                      label: t("profile.genderNotSpecified"),
                      value: "NotSpecified",
                    },
                    { label: t("profile.genderMale"), value: "Male" },
                    { label: t("profile.genderFemale"), value: "Female" },
                  ]}
                />
              </div>
            </div>

            <div className="edit-profile-page__field">
              <label>{t("profile.birthDate")}</label>
              <input
                type="date"
                value={birthDateValue}
                onChange={(e) => setBirthDateValue(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </section>

          <section className="edit-profile-section">
            <p className="edit-profile-section__label">
              {t("profile.biography")}
            </p>
            <div className="edit-profile-page__field">
              <label>
                <span />
                <span className="edit-profile-page__char-count">
                  {biographyValue.length}/{BIOGRAPHY_MAX_LENGTH}
                </span>
              </label>
              <textarea
                value={biographyValue}
                onChange={(e) => setBiographyValue(e.target.value)}
                maxLength={BIOGRAPHY_MAX_LENGTH}
                rows={5}
                placeholder={t("profile.biographyPlaceholder")}
              />
            </div>
          </section>

          <div className="edit-profile-page__actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saveMutation.isPending || uploadMutation.isPending}
            >
              {saveMutation.isPending && (
                <Loader2 size={14} className="edit-profile-page__spinner" />
              )}
              {t("common.save")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
