import { useTranslation } from "react-i18next";
import LegalPage from "./LegalPage";

const CONTACT_EMAIL = "iletisim@ufmdb.com";

export default function PrivacyPolicyPage() {
  const { t, i18n } = useTranslation();
  const tr = i18n.language === "tr";

  return (
    <LegalPage
      title={t("footer.privacy")}
      updatedAt={tr ? "Son güncelleme: Ekim 2026" : "Last updated: October 2026"}
    >
      {tr ? (
        <>
          <p>
            UFMDb, film keşfi/koleksiyon takibi amaçlı eğitim ve portföy amaçlı geliştirilmiş bir
            projedir. Bu sayfa, hesap oluşturduğunda hangi verilerin toplandığını ve nasıl
            kullanıldığını açıklar.
          </p>

          <h2>Topladığımız veriler</h2>
          <ul>
            <li>Hesap oluştururken verdiğin e-posta adresi ve şifren (şifre asla düz metin olarak saklanmaz, geri döndürülemez şekilde hash'lenir).</li>
            <li>Profilinde isteğe bağlı olarak eklediğin görünen ad ve profil fotoğrafı.</li>
            <li>Platformda ürettiğin içerik: puanlar, review'lar, listeler, izleme/seans kayıtları, takip ettiğin kullanıcılar.</li>
            <li>Oturum açık kalsın diye bir erişim token'ı ve bir yenileme (refresh) çerezi.</li>
          </ul>

          <h2>Verileri nasıl kullanıyoruz</h2>
          <p>
            Topladığımız veriler yalnızca hesabını çalıştırmak, profilini ve etkileşimlerini
            (puan, review, liste, takip) diğer kullanıcılara göstermek için kullanılır. Verilerini
            satmıyoruz, reklam amaçlı üçüncü taraflarla paylaşmıyoruz.
          </p>

          <h2>Çerezler</h2>
          <p>
            Yalnızca oturumunu açık tutmak için gerekli olan bir yenileme token'ı çerez olarak
            saklanır. Takip/analitik/reklam amaçlı çerez kullanılmaz.
          </p>

          <h2>Film verileri</h2>
          <p>
            Film, oyuncu ve yönetmen bilgileri{" "}
            <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
              The Movie Database (TMDB)
            </a>{" "}
            API'sinden alınır. Bu ürün TMDB API kullanır ancak TMDB tarafından onaylanmış veya
            sertifikalandırılmış değildir.
          </p>

          <h2>Verilerinin silinmesi</h2>
          <p>
            Şu an hesabını uygulama içinden kendin silebileceğin bir özellik bulunmuyor. Hesabının
            ve verilerinin silinmesini istersen{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> adresinden bize ulaşman
            yeterli.
          </p>

          <h2>İletişim</h2>
          <p>
            Bu politikayla ilgili sorularını <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
            adresine iletebilirsin.
          </p>
        </>
      ) : (
        <>
          <p>
            UFMDb is an educational/portfolio project for discovering and tracking films. This
            page explains what data is collected when you create an account and how it's used.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>The email address and password you provide when registering (passwords are never stored in plain text — they are irreversibly hashed).</li>
            <li>Any display name and profile photo you optionally add.</li>
            <li>Content you create on the platform: ratings, reviews, lists, screening logs, and the users you follow.</li>
            <li>An access token and a refresh-token cookie used to keep you signed in.</li>
          </ul>

          <h2>How we use it</h2>
          <p>
            Your data is used solely to run your account and to show your profile and activity
            (ratings, reviews, lists, follows) to other users. We do not sell your data or share
            it with third parties for advertising.
          </p>

          <h2>Cookies</h2>
          <p>
            Only a refresh-token cookie required to keep you signed in is stored. No
            tracking, analytics, or advertising cookies are used.
          </p>

          <h2>Movie data</h2>
          <p>
            Movie, cast, and crew information is sourced from the{" "}
            <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
              The Movie Database (TMDB)
            </a>{" "}
            API. This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>

          <h2>Deleting your data</h2>
          <p>
            There's currently no self-service way to delete your account from within the app. If
            you'd like your account and data deleted, just email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </>
      )}
    </LegalPage>
  );
}
