import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Film,
  Search,
  ListVideo,
  User,
  Shield,
  Sun,
  Moon,
  LogOut,
  Ticket,
  Languages,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store";
import { toggleTheme } from "@/store/uiSlice";
import { logout } from "@/store/authSlice";
import { authService } from "@/services";
import { SUPPORTED_LANGUAGES, languageLabel } from "@/i18n/languages";
import Dropdown from "@/components/search/Dropdown";
import "./Navbar.css";

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const theme = useAppSelector((s) => s.ui.theme);
  const { isAuthenticated, userName, role } = useAppSelector((s) => s.auth);

  const languageOptions = SUPPORTED_LANGUAGES.map((lng) => ({
    label: languageLabel(lng),
    value: lng,
  }));

  const handleLangChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem("ufmdb_language", value);
  };

  const handleLogout = async () => {
    await authService.logout();
    dispatch(logout());
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="navbar__logo">
          <Film size={22} color="#4a90e2" />
          <span>UFMDb</span>
        </Link>

        <nav className="navbar__links">
          <Link to="/">{t("nav.home")}</Link>
          <Link to="/search">
            <Search size={16} /> {t("nav.search")}
          </Link>
          <Link to="/lists">
            <ListVideo size={16} /> {t("nav.lists")}
          </Link>
          {isAuthenticated && (
            <Link to="/log">
              <Ticket size={16} /> {t("nav.log")}
            </Link>
          )}
          {role === "Admin" && (
            <Link to="/admin">
              <Shield size={16} /> {t("nav.admin")}
            </Link>
          )}
        </nav>

        <div className="navbar__actions">
          <Dropdown
            icon={<Languages size={14} />}
            value={i18n.language}
            options={languageOptions}
            onChange={handleLangChange}
          />
          <button
            className="navbar__icon-btn"
            onClick={() => dispatch(toggleTheme())}
            title="Tema"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {isAuthenticated ? (
            <div className="navbar__user">
              <Link to="/profile" className="navbar__user-chip">
                <User size={16} /> {userName}
              </Link>
              <button
                className="navbar__icon-btn"
                onClick={handleLogout}
                title={t("nav.logout")}
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="navbar__auth-links">
              <Link to="/login" className="btn-secondary">
                {t("nav.login")}
              </Link>
              <Link to="/register" className="btn-primary">
                {t("nav.register")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
