import { Trans, useTranslation } from "react-i18next";
import LegalPage from "./LegalPage";

const CONTACT_EMAIL = "iletisim@ufmdb.com";
const TMDB_URL = "https://www.themoviedb.org/";

interface LegalSection {
  heading: string;
  body?: string;
  items?: string[];
}

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();

  // "collect" bir liste, "movieData" ve "deletion" birer link/e-posta
  // içerdiği için (Trans ile) ayrı render ediliyor; geri kalanı generic.
  const sections = t("privacy.sections", { returnObjects: true }) as Record<
    string,
    LegalSection
  >;

  const collectItems = sections.collect?.items ?? [];

  return (
    <LegalPage title={t("footer.privacy")} updatedAt={t("privacy.updatedAt")}>
      <p>{t("privacy.intro")}</p>

      <h2>{sections.collect?.heading}</h2>
      <ul>
        {collectItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>{sections.use?.heading}</h2>
      <p>{sections.use?.body}</p>

      <h2>{sections.cookies?.heading}</h2>
      <p>{sections.cookies?.body}</p>

      <h2>{sections.movieData?.heading}</h2>
      <p>
        <Trans
          i18nKey="privacy.sections.movieData.body"
          components={{
            tmdb: (
              <a href={TMDB_URL} target="_blank" rel="noopener noreferrer" />
            ),
          }}
        />
      </p>

      <h2>{sections.deletion?.heading}</h2>
      <p>
        <Trans
          i18nKey="privacy.sections.deletion.body"
          values={{ emailAddress: CONTACT_EMAIL }}
          components={{ email: <a href={`mailto:${CONTACT_EMAIL}`} /> }}
        />
      </p>

      <h2>{t("privacy.contactHeading")}</h2>
      <p>
        <Trans
          i18nKey="privacy.contactBody"
          values={{ emailAddress: CONTACT_EMAIL }}
          components={{ email: <a href={`mailto:${CONTACT_EMAIL}`} /> }}
        />
      </p>
    </LegalPage>
  );
}
