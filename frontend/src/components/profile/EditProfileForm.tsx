import { useState, useRef, type FormEvent, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, User, Upload, Loader2, ImageOff } from "lucide-react";
import { profileService } from "@/services";
import "./EditProfileForm.css";

interface Props {
  userName: string;
  avatarUrl: string | null;
  onClose: () => void;
}

export default function EditProfileForm({
  userName,
  avatarUrl,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(userName);
  const [avatar, setAvatar] = useState(avatarUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(avatarUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: (url) => {
      setAvatar(url);
    },
    onError: () => setError(t("profile.uploadError")),
  });

  const saveMutation = useMutation({
    mutationFn: () => profileService.updateProfile(name, avatar.trim() || null),
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
