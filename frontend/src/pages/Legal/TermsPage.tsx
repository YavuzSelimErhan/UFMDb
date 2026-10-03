import { Trans, useTranslation } from "react-i18next";
import LegalPage from "./LegalPage";

const CONTACT_EMAIL = "iletisim@ufmdb.com";

interface LegalSection {
  heading: string;
  body: string;
}

export default function TermsPage() {
  const { t } = useTranslation();

  // Tüm tr/en içerik artık çeviri dosyalarında (terms.*) — burada sadece
  // o yapıyı okuyup render ediyoruz. Yeni bir madde eklemek istediğinizde
  // tek yapmanız gereken tr.json + en.json'a yeni bir section eklemek;
  // bu dosyaya dokunmanıza gerek kalmıyor.
  const sections = t("terms.sections", { returnObjects: true }) as Record<
    string,
    LegalSection
  >;

  return (
    <LegalPage title={t("footer.terms")} updatedAt={t("terms.updatedAt")}>
      <p>{t("terms.intro")}</p>

      {Object.entries(sections).map(([key, section]) => (
        <section key={key}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}

      <h2>{t("terms.contactHeading")}</h2>
      <p>
        <Trans
          i18nKey="terms.contactBody"
          values={{ emailAddress: CONTACT_EMAIL }}
          components={{ email: <a href={`mailto:${CONTACT_EMAIL}`} /> }}
        />
      </p>
    </LegalPage>
  );
}
