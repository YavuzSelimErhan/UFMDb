import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import "./LegalPage.css";

interface Props {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

/** Gizlilik Politikası / Kullanım Koşulları gibi statik metin sayfaları için ortak kabuk. */
export default function LegalPage({ title, updatedAt, children }: Props) {
  const { t } = useTranslation();

  return (
    <div className="container legal-page">
      <Link to="/" className="legal-page__back">
        <ChevronLeft size={14} /> {t("nav.home")}
      </Link>
      <h1>{title}</h1>
      <p className="legal-page__updated text-muted">{updatedAt}</p>
      <div className="legal-page__body">{children}</div>
    </div>
  );
}
