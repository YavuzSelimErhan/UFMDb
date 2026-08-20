import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Film, Github, Twitter, Instagram, Play } from "lucide-react";
import "./Footer.css";

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="ft-root" role="contentinfo">
      <div className="ft-topline" aria-hidden="true" />
      <div className="ft-grain" aria-hidden="true" />

      <div className="container ft-container">
        {/* ---------- Tagline row with film-reel dots ---------- */}
        <div className="ft-tagline-row">
          <div className="ft-reel" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="ft-tagline">{t("footer.tagline")}</p>
          <div className="ft-reel ft-reel--r" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="ft-divider" aria-hidden="true" />

        {/* ---------- Main grid ---------- */}
        <div className="ft-grid">
          <div className="ft-col ft-col--brand">
            <Link to="/" className="ft-brand">
              <Film size={22} />
              <span className="ft-brand__logo">UFMDb</span>
              <span className="ft-brand__dot" aria-hidden="true" />
            </Link>
            <p className="ft-brand__desc">{t("footer.brandDescription")}</p>
            <div className="ft-socials">
              <a href="#" className="ft-social" aria-label="Twitter / X">
                <Twitter size={15} />
              </a>
              <a href="#" className="ft-social" aria-label="Instagram">
                <Instagram size={15} />
              </a>
              <a
                href="https://github.com/YavuzSelimErhan"
                className="ft-social"
                aria-label="GitHub"
              >
                <Github size={15} />
              </a>
            </div>
          </div>

          <div className="ft-col">
            <h3 className="ft-col__title">{t("footer.discover")}</h3>
            <nav>
              <ul className="ft-links">
                <li>
                  <Link to="/" className="ft-link">
                    {t("nav.home")}
                  </Link>
                </li>
                <li>
                  <Link to="/search" className="ft-link">
                    {t("nav.search")}
                  </Link>
                </li>
                <li>
                  <Link to="/lists" className="ft-link">
                    {t("nav.lists")}
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="ft-col">
            <h3 className="ft-col__title">{t("footer.account")}</h3>
            <nav>
              <ul className="ft-links">
                <li>
                  <Link to="/profile" className="ft-link">
                    {t("nav.profile")}
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="ft-link">
                    {t("nav.login")}
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="ft-link">
                    {t("nav.register")}
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="ft-col">
            <h3 className="ft-col__title">{t("footer.about")}</h3>
            <nav>
              <ul className="ft-links">
                <li>
                  <a href="#" className="ft-link">
                    {t("footer.privacy")}
                  </a>
                </li>
                <li>
                  <a href="#" className="ft-link">
                    {t("footer.terms")}
                  </a>
                </li>
                <li>
                  <a href="#" className="ft-link">
                    {t("footer.contact")}
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* ---------- Bottom bar ---------- */}
        <div className="ft-bottom">
          <p className="ft-copy">
            <span className="ft-copy__sym" aria-hidden="true">
              ©
            </span>
            <time dateTime={String(year)}>{year}</time> UFMDb.{" "}
            {t("footer.allRightsReserved")}
          </p>
          <p className="ft-made">
            <Play size={11} className="ft-made__icon" aria-hidden="true" />
            {t("footer.madeWith")}
          </p>
        </div>
      </div>
    </footer>
  );
}
