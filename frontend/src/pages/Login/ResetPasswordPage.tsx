import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Clapperboard, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { authService } from "@/services";
import "./AuthPages.css";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => authService.resetPassword(token!, newPassword),
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { title?: string } } })
        ?.response?.data?.title;
      setError(message ?? t("auth.resetPasswordError"));
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    mutation.mutate();
  };

  const showcase = (
    <div className="auth-page__showcase" aria-hidden="true">
      <div className="auth-page__ticket-label">
        <span>ADMIT ONE</span>
        <span>No. 000047</span>
      </div>

      <div className="auth-page__showcase-middle">
        <div className="auth-page__reel">
          <div className="auth-page__reel-ring" />
          <div className="auth-page__reel-hub" />
          <span className="auth-page__reel-hole" />
          <span className="auth-page__reel-hole" />
          <span className="auth-page__reel-hole" />
          <span className="auth-page__reel-hole" />
          <span className="auth-page__reel-hole" />
          <span className="auth-page__reel-hole" />
        </div>
        <span className="auth-page__brand">
          <Clapperboard size={20} /> UFMDb
        </span>
        <p className="auth-page__tagline">{t("auth.tagline")}</p>
      </div>

      <div className="auth-page__barcode-wrap">
        <div className="auth-page__barcode" />
      </div>

      <div className="auth-page__perf" />
    </div>
  );

  // Token URL'de hiç yoksa (link bozuk kopyalanmış, eski bir sayfa bookmark'lanmış vb.)
  // formu hiç göstermiyoruz — zaten gönderildiğinde backend reddedecek, bunu baştan söylemek
  // daha net bir deneyim.
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-shell">
          {showcase}
          <div className="auth-page__form-side">
            <div className="auth-page__mobile-brand">
              <span className="auth-page__brand">
                <Clapperboard size={18} /> UFMDb
              </span>
            </div>
            <div className="auth-card">
              <span className="auth-card__eyebrow">
                {t("auth.resetPasswordEyebrow")}
              </span>
              <h1>{t("auth.resetPasswordTitle")}</h1>
              <p className="auth-error">{t("auth.resetPasswordInvalidLink")}</p>
              <Link to="/forgot-password" className="btn-primary auth-card__link-btn">
                {t("auth.forgotPassword")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        {showcase}

        <div className="auth-page__form-side">
          <div className="auth-page__mobile-brand">
            <span className="auth-page__brand">
              <Clapperboard size={18} /> UFMDb
            </span>
          </div>

          <form className="auth-card" onSubmit={handleSubmit}>
            <span className="auth-card__eyebrow">
              {t("auth.resetPasswordEyebrow")}
            </span>
            <h1>{t("auth.resetPasswordTitle")}</h1>

            {mutation.isSuccess ? (
              <>
                <p className="auth-success">{t("auth.resetPasswordSuccess")}</p>
                <Link to="/login" className="btn-primary auth-card__link-btn">
                  {t("nav.login")}
                </Link>
              </>
            ) : (
              <>
                {error && <p className="auth-error">{error}</p>}
                <p className="auth-card__desc">{t("auth.resetPasswordDesc")}</p>

                <label htmlFor="reset-new-password">
                  {t("auth.newPassword")}
                </label>
                <div className="auth-card__password-field">
                  <input
                    id="reset-new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="auth-card__password-toggle"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={
                      showPassword
                        ? t("auth.hidePassword")
                        : t("auth.showPassword")
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <label htmlFor="reset-confirm-password">
                  {t("auth.confirmPassword")}
                </label>
                <input
                  id="reset-confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? t("common.loading")
                    : t("auth.resetPasswordSubmit")}
                </button>
              </>
            )}

            <p className="text-muted auth-switch">
              <Link
                to="/login"
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <ChevronLeft size={14} /> {t("auth.backToLogin")}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
