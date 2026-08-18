import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Clapperboard, ChevronLeft } from "lucide-react";
import { authService } from "@/services";
import "./AuthPages.css";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => authService.requestPasswordReset(email),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-page__showcase" aria-hidden="true">
          <div className="auth-page__ticket-label">
            <span>ADMIT ONE</span>
            <span>No. 000032</span>
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

        <div className="auth-page__form-side">
          <div className="auth-page__mobile-brand">
            <span className="auth-page__brand">
              <Clapperboard size={18} /> UFMDb
            </span>
          </div>

          <form className="auth-card" onSubmit={handleSubmit}>
            <span className="auth-card__eyebrow">
              {t("auth.forgotPasswordEyebrow")}
            </span>
            <h1>{t("auth.forgotPasswordTitle")}</h1>

            {mutation.isSuccess ? (
              <p className="auth-success">{t("auth.forgotPasswordSent")}</p>
            ) : (
              <>
                <p className="auth-card__desc">
                  {t("auth.forgotPasswordDesc")}
                </p>
                <label htmlFor="forgot-email">{t("auth.email")}</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  autoComplete="email"
                  required
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? t("common.loading")
                    : t("auth.forgotPasswordSubmit")}
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
