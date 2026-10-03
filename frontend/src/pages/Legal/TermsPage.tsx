import { useTranslation } from "react-i18next";
import LegalPage from "./LegalPage";

const CONTACT_EMAIL = "iletisim@ufmdb.com";

export default function TermsPage() {
  const { t, i18n } = useTranslation();
  const tr = i18n.language === "tr";

  return (
    <LegalPage
      title={t("footer.terms")}
      updatedAt={tr ? "Son güncelleme: Ekim 2026" : "Last updated: October 2026"}
    >
      {tr ? (
        <>
          <p>
            UFMDb'yi kullanarak aşağıdaki koşulları kabul etmiş olursun. UFMDb, ticari bir hizmet
            değil, eğitim ve portföy amaçlı geliştirilmiş bir projedir; bu nedenle herhangi bir
            kesintisizlik ya da veri kalıcılığı garantisi verilmez.
          </p>

          <h2>Hesabın</h2>
          <p>
            Hesap bilgilerinin (e-posta, şifre) gizliliğinden sen sorumlusun. Hesabın üzerinden
            yapılan tüm işlemlerden hesap sahibi sorumlu tutulur.
          </p>

          <h2>Paylaştığın içerik</h2>
          <p>
            Yazdığın review'lar, oluşturduğun listeler ve yüklediğin görseller sana aittir; bunları
            yayınlayarak platformda diğer kullanıcılara görünür olmasına izin vermiş olursun.
            Başkasına ait telif hakkıyla korunan içerik, nefret söylemi veya taciz içeren içerik
            paylaşmaman beklenir — bu tür içerikler bildirimsiz kaldırılabilir.
          </p>

          <h2>Film verileri</h2>
          <p>
            Platformdaki film/oyuncu/yönetmen bilgileri TMDB'den alınır ve yalnızca gösterim
            amaçlıdır; doğruluğu ya da güncelliği için bir garanti verilmez.
          </p>

          <h2>Hizmetin durumu</h2>
          <p>
            Proje aktif geliştirme halindedir; özellikler önceden haber verilmeden değişebilir,
            eklenebilir veya kaldırılabilir, ve hizmet zaman zaman kesintiye uğrayabilir.
          </p>

          <h2>İletişim</h2>
          <p>
            Bu koşullarla ilgili sorularını{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> adresine iletebilirsin.
          </p>
        </>
      ) : (
        <>
          <p>
            By using UFMDb you agree to the terms below. UFMDb is not a commercial service — it's
            an educational/portfolio project, so no guarantee of uptime or data permanence is
            provided.
          </p>

          <h2>Your account</h2>
          <p>
            You're responsible for keeping your account credentials (email, password)
            confidential. The account holder is responsible for all activity under that account.
          </p>

          <h2>Content you share</h2>
          <p>
            Reviews you write, lists you create, and images you upload remain yours; by posting
            them you allow them to be visible to other users on the platform. You're expected not
            to post content that infringes someone else's copyright or contains hate speech or
            harassment — such content may be removed without notice.
          </p>

          <h2>Movie data</h2>
          <p>
            Movie, cast, and crew information on the platform is sourced from TMDB and provided
            for display purposes only; no guarantee of its accuracy or currency is made.
          </p>

          <h2>Status of the service</h2>
          <p>
            The project is under active development; features may change, be added, or removed
            without prior notice, and the service may occasionally be unavailable.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </>
      )}
    </LegalPage>
  );
}
