// BetaNotice metinleri. translation.json'a dokunmadan, bileşenin yanında tutuluyor.
// Yeni bir dil eklendiğinde buraya da o dilin karşılığını ekle; bulunamazsa Türkçe gösterilir.
export interface BetaNoticeText {
  badge: string;
  title: string;
  description: string;
  contactIntro: string;
  emailLabel: string;
  githubLabel: string;
  thanks: string;
  confirm: string;
  closeAria: string;
}

const tr: BetaNoticeText = {
  badge: "BETA",
  title: "UFMDb şu an beta aşamasında",
  description:
    "Siteyi geliştirmeye devam ediyoruz; bu sırada hatalarla veya eksik özelliklerle karşılaşabilirsin.",
  contactIntro:
    "Bir hata bulursan ya da bir önerin varsa bize şu adreslerden ulaşabilirsin:",
  emailLabel: "E-posta",
  githubLabel: "GitHub (hata / öneri bildir)",
  thanks: "Geri bildirimlerin UFMDb'yi daha iyi yapıyor, teşekkürler!",
  confirm: "Anladım",
  closeAria: "Kapat",
};

const en: BetaNoticeText = {
  badge: "BETA",
  title: "UFMDb is currently in beta",
  description:
    "We're still improving the site, so you may run into bugs or missing features along the way.",
  contactIntro:
    "If you find a bug or have a suggestion, you can reach us here:",
  emailLabel: "Email",
  githubLabel: "GitHub (report bugs / suggestions)",
  thanks: "Your feedback makes UFMDb better, thank you!",
  confirm: "Got it",
  closeAria: "Close",
};

const texts: Record<string, BetaNoticeText> = { tr, en };

export function getBetaNoticeText(language: string | undefined): BetaNoticeText {
  const code = (language ?? "tr").toLowerCase().split("-")[0];
  return texts[code] ?? tr;
}
