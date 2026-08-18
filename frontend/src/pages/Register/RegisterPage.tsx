import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Clapperboard, Eye, EyeOff } from "lucide-react";
import { authService } from "@/services";
import { useAppDispatch } from "@/store";
import { setCredentials } from "@/store/authSlice";
import "../Login/AuthPages.css";

export default function RegisterPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: () => authService.register(userName, email, password),
    onSuccess: (data) => {
      dispatch(setCredentials(data));
      navigate("/");
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { title?: string } } })
        ?.response?.data?.title;
      setError(message ?? t("auth.registerError"));
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    registerMutation.mutate();
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-page__showcase" aria-hidden="true">
          <div className="auth-page__ticket-label">
            <span>ADMIT ONE</span>
            <span>No. 004871</span>
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
              {t("auth.registerEyebrow")}
            </span>
            <h1>{t("auth.registerTitle")}</h1>
            {error && <p className="auth-error">{error}</p>}

            <label htmlFor="register-username">{t("auth.username")}</label>
            <input
              id="register-username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={t("auth.usernamePlaceholder")}
              autoComplete="username"
              minLength={3}
              required
            />

            <label htmlFor="register-email">{t("auth.email")}</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              autoComplete="email"
              required
            />

            <label htmlFor="register-password">{t("auth.password")}</label>
            <div className="auth-card__password-field">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="auth-card__password-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={
                  showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                }
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <label htmlFor="register-confirm-password">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="register-confirm-password"
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
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending
                ? t("common.loading")
                : t("auth.submit")}
            </button>

            <p className="text-muted auth-switch">
              {t("auth.haveAccount")} <Link to="/login">{t("nav.login")}</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
