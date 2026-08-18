import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Clapperboard, Eye, EyeOff } from "lucide-react";
import { authService } from "@/services";
import { useAppDispatch } from "@/store";
import { setCredentials } from "@/store/authSlice";
import "./AuthPages.css";

export default function LoginPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => authService.login(email, password),
    onSuccess: (data) => {
      dispatch(setCredentials(data));
      navigate("/");
    },
    onError: () => setError(t("auth.invalidCredentials")),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate();
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-page__showcase" aria-hidden="true">
          <div className="auth-page__ticket-label">
            <span>ADMIT ONE</span>
            <span>No. 001204</span>
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
            <span className="auth-card__eyebrow">{t("auth.loginEyebrow")}</span>
            <h1>{t("auth.loginTitle")}</h1>
            {error && <p className="auth-error">{error}</p>}

            <label htmlFor="login-email">{t("auth.email")}</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              autoComplete="email"
              required
            />

            <div className="auth-card__label-row">
              <label htmlFor="login-password">{t("auth.password")}</label>
              <Link to="/forgot-password" className="auth-card__forgot-link">
                {t("auth.forgotPassword")}
              </Link>
            </div>
            <div className="auth-card__password-field">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

            <button
              type="submit"
              className="btn-primary"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? t("common.loading") : t("auth.submit")}
            </button>

            <p className="text-muted auth-switch">
              {t("auth.noAccount")}{" "}
              <Link to="/register">{t("nav.register")}</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
