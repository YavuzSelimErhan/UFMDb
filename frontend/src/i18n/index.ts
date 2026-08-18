import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import tr from "./locales/tr/translation.json";
import en from "./locales/en/translation.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    fallbackLng: "tr",
    supportedLngs: ["tr", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "ufmdb_language",
    },
  });

// <html lang="..."> özniteliğini i18n diliyle senkronize tutuyoruz.
// Tarayıcılar text-transform: uppercase gibi CSS kurallarını locale'e duyarlı uyguluyor
// (örn. html lang="tr" iken İngilizce "Films" kelimesi "FİLMS" olarak büyütülebiliyor) —
// bu senkronizasyon olmadan dil değiştirmek görsel tutarsızlıklara yol açar.
const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
};
syncHtmlLang(i18n.language);
i18n.on("languageChanged", syncHtmlLang);

export default i18n;
