import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Globe,
  Languages,
  Lock,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { profileService, authService } from "@/services";
import { useAppDispatch, useAppSelector } from "@/store";
import { setTheme } from "@/store/uiSlice";
import { logout } from "@/store/authSlice";
import { SUPPORTED_LANGUAGES, languageLabel } from "@/i18n/languages";
import Dropdown from "@/components/search/Dropdown";
import { useToast } from "@/components/common/Toast";
import type { DiaryVisibility, ProfileData } from "@/types";
import "./SettingsTab.css";

type ThemeValue = "dark" | "light";

const THEME_OPTIONS: {
  value: ThemeValue;
  icon: typeof Moon;
  labelKey: string;
}[] = [
  { value: "dark", icon: Moon, labelKey: "profile.themeDark" },
  { value: "light", icon: Sun, labelKey: "profile.themeLight" },
];

const DIARY_OPTIONS: {
  value: DiaryVisibility;
  icon: typeof Globe;
  labelKey: string;
  descKey: string;
}[] = [
  {
    value: "Public",
    icon: Globe,
    labelKey: "profile.diaryPublic",
    descKey: "profile.diaryPublicDesc",
  },
  {
    value: "Followers",
    icon: Users,
    labelKey: "profile.diaryFollowers",
    descKey: "profile.diaryFollowersDesc",
  },
  {
    value: "Private",
    icon: Lock,
    labelKey: "profile.diaryPrivate",
    descKey: "profile.diaryPrivateDesc",
  },
];

interface SettingsTabProps {
  diaryVisibility: DiaryVisibility;
}

export default function SettingsTab({ diaryVisibility }: SettingsTabProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const theme = useAppSelector((s) => s.ui.theme);

  /* ---------- Tema & dil ---------- */

  const settingsMutation = useMutation({
    mutationFn: ({ language, theme }: { language: string; theme: string }) =>
      profileService.updateSettings(language, theme),
  });

  const handleThemeChange = (value: ThemeValue) => {
    if (value === theme) return;
    dispatch(setTheme(value));
    settingsMutation.mutate({ language: i18n.language, theme: value });
  };

  const handleLangChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem("ufmdb_language", value);
    settingsMutation.mutate({ language: value, theme });
  };

  const languageOptions = SUPPORTED_LANGUAGES.map((lng) => ({
    label: languageLabel(lng),
    value: lng,
  }));

  /* ---------- Seans Defteri gizliliği ---------- */

  const diaryMutation = useMutation({
    mutationFn: (visibility: DiaryVisibility) =>
      profileService.updateDiaryVisibility(visibility),
    onSuccess: (_data, visibility) => {
      queryClient.setQueryData<ProfileData>(
        ["my-profile"],
        (prev) => prev && { ...prev, diaryVisibility: visibility },
      );
    },
    onError: () => showToast(t("common.genericError"), "error"),
  });

  // Kaydedilirken seçilen değer anında vurgulanır; hata olursa eskiye döner.
  const currentDiary: DiaryVisibility =
    diaryMutation.isPending && diaryMutation.variables
      ? diaryMutation.variables
      : diaryVisibility;

  /* ---------- Hesap silme ---------- */

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteAccountMutation = useMutation({
    mutationFn: (password: string) => profileService.deleteAccount(password),
    onSuccess: async () => {
      // Backend zaten tüm refresh token'ları iptal etti; /auth/logout
      // çağrısı sadece httpOnly refresh cookie'sini temizlemek için.
      await authService.logout().catch(() => {});
      dispatch(logout());
      navigate("/");
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      setDeleteError(
        status === 401
          ? t("profile.deleteAccountWrongPassword")
          : t("profile.deleteAccountError"),
      );
    },
  });

  const handleDeleteAccount = (e: FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    deleteAccountMutation.mutate(deletePassword);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletePassword("");
    setDeleteError(null);
  };

  return (
    <div className="settings-tab">
      {/* ===== Görünüm ve dil ===== */}
      <section className="settings-card card">
        <header className="settings-card__header">
          <span className="settings-card__icon">
            <Palette size={16} />
          </span>
          <div>
            <h2>{t("profile.appearance")}</h2>
            <p>{t("profile.appearanceHint")}</p>
          </div>
        </header>

        <div className="settings-field">
          <span className="settings-field__label" id="settings-theme-label">
            {t("profile.theme")}
          </span>
          <div
            className="settings-theme"
            role="radiogroup"
            aria-labelledby="settings-theme-label"
          >
            {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => {
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`settings-theme__tile ${selected ? "is-selected" : ""}`}
                  onClick={() => handleThemeChange(value)}
                >
                  <span
                    className={`settings-theme__preview settings-theme__preview--${value}`}
                    aria-hidden="true"
                  >
                    <span className="settings-theme__nav" />
                    <span className="settings-theme__row">
                      <span className="settings-theme__poster" />
                      <span className="settings-theme__poster" />
                      <span className="settings-theme__poster" />
                    </span>
                  </span>
                  <span className="settings-theme__label">
                    <Icon size={14} />
                    {t(labelKey)}
                    {selected && (
                      <Check size={14} className="settings-theme__check" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="settings-field settings-field--inline">
          <div className="settings-field__text">
            <span className="settings-field__label">
              {t("profile.language")}
            </span>
            <p className="settings-field__hint">{t("profile.languageHint")}</p>
          </div>
          <Dropdown
            icon={<Languages size={14} />}
            value={i18n.language}
            options={languageOptions}
            onChange={handleLangChange}
          />
        </div>
      </section>

      {/* ===== Gizlilik ===== */}
      <section className="settings-card card">
        <header className="settings-card__header">
          <span className="settings-card__icon">
            <ShieldCheck size={16} />
          </span>
          <div>
            <h2>{t("profile.privacy")}</h2>
            <p>{t("profile.privacyHint")}</p>
          </div>
        </header>

        <div className="settings-field">
          <div className="settings-field__text">
            <span className="settings-field__label" id="settings-diary-label">
              {t("profile.diaryVisibility")}
            </span>
            <p className="settings-field__hint">
              {t("profile.diaryVisibilityHint")}
            </p>
          </div>
          <div
            className="settings-choice"
            role="radiogroup"
            aria-labelledby="settings-diary-label"
          >
            {DIARY_OPTIONS.map(({ value, icon: Icon, labelKey, descKey }) => {
              const selected = currentDiary === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`settings-choice__option ${selected ? "is-selected" : ""}`}
                  disabled={diaryMutation.isPending}
                  onClick={() => {
                    if (!selected) diaryMutation.mutate(value);
                  }}
                >
                  <span className="settings-choice__icon">
                    <Icon size={16} />
                  </span>
                  <span className="settings-choice__text">
                    <span className="settings-choice__label">
                      {t(labelKey)}
                    </span>
                    <span className="settings-choice__desc">{t(descKey)}</span>
                  </span>
                  <span className="settings-choice__radio" aria-hidden="true">
                    {selected && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Tehlikeli alan ===== */}
      <section className="settings-card settings-card--danger card">
        <header className="settings-card__header">
          <span className="settings-card__icon">
            <Trash2 size={16} />
          </span>
          <div>
            <h2>{t("profile.dangerZone")}</h2>
            <p>{t("profile.deleteAccountWarning")}</p>
          </div>
        </header>

        {!deleteOpen ? (
          <div className="settings-danger__actions">
            <button
              type="button"
              className="settings-btn settings-btn--danger-outline"
              onClick={() => setDeleteOpen(true)}
            >
              {t("profile.deleteAccount")}
            </button>
          </div>
        ) : (
          <form
            className="settings-danger__form"
            onSubmit={handleDeleteAccount}
          >
            <label htmlFor="delete-account-password">
              {t("profile.deleteAccountConfirmPrompt")}
            </label>
            <input
              id="delete-account-password"
              className="settings-danger__input"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
            {deleteError && (
              <p className="settings-danger__error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="settings-danger__buttons">
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
                disabled={deleteAccountMutation.isPending}
                onClick={closeDelete}
              >
                {t("profile.deleteAccountCancel")}
              </button>
              <button
                type="submit"
                className="settings-btn settings-btn--danger"
                disabled={deleteAccountMutation.isPending || !deletePassword}
              >
                {deleteAccountMutation.isPending
                  ? t("common.loading")
                  : t("profile.deleteAccountConfirm")}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
