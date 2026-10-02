import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Clapperboard, Eye, EyeOff } from "lucide-react";
import { authService } from "@/services";
import { useAppDispatch } from "@/store";
import { setCredentials } from "@/store/authSlice";
import { parseApiError } from "@/utils/apiError";
import {
  isPasswordValid,
  getFailingPasswordMessages,
} from "@/utils/passwordRules";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
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
  const [passwordTouched, setPasswordTouched] = useState(false);
  // Tek bir "error" yerine bir liste: backend birden fazla alan için
  // (ör. hem Password hem Email) birden fazla mesaj dönebiliyor; hepsini
  // gösteriyoruz, sadece genel "title"ı değil.
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const registerMutation = useMutation({
    mutationFn: () => authService.register(userName, email, password),
    onSuccess: (data) => {
      dispatch(setCredentials(data));
      navigate("/");
    },
    onError: (err: unknown) => {
      const parsed = parseApiError(err, t("auth.registerError"));
      const messages = Object.values(parsed.fieldErrors).flat();
      // Backend errors objesi doluysa (çoğu durumda) gerçek mesajları,
      // boşsa (ör. ağ hatası, 500) genel başlığı göster.
      setFormErrors(messages.length > 0 ? messages : [parsed.title]);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    // İstemci tarafı ön-doğrulama: sunucuya hiç gitmeden, checklist'teki
    // aynı kuralları burada da kontrol ediyoruz. Kurallar eşleşmiyorsa
    // (ör. backend'de ekstra bir kural varsa) kullanıcı yine de submit
    // edebilir ve gerçek hatayı backend'den (onError) görür — bu yüzden
    // bu kontrol bir optimizasyon, tek doğrulama katmanı değil.
    if (!isPasswordValid(password)) {
      setPasswordTouched(true);
      setFormErrors(getFailingPasswordMessages(password, t));
      return;
    }
    if (password !== confirmPassword) {
      setFormErrors([t("auth.passwordMismatch")]);
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

            {formErrors.length > 0 && (
              <ul
                className="auth-error-list"
                style={{ listStyle: "none", margin: "0 0 14px", padding: 0 }}
              >
                {formErrors.map((msg) => (
                  <li key={msg} className="auth-error">
                    {msg}
                  </li>
                ))}
              </ul>
            )}

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
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordTouched(true);
                }}
                onBlur={() => setPasswordTouched(true)}
                autoComplete="new-password"
                minLength={8}
                aria-describedby="register-password-rules"
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
            <div id="register-password-rules">
              <PasswordChecklist
                password={password}
                touched={passwordTouched}
              />
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
