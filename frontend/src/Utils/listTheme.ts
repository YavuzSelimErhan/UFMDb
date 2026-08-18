export interface ListTheme {
  accent: string;
  accentSoft: string; // arka plan/badge tonlaması için düşük opaklık
  accentStrong: string; // gradient/hover için biraz daha koyu ton
}

// Altı "program şeridi" teması — repertuar sinemasının farklı seansları gibi düşünülebilir.
// İleride admin panelinden liste bazlı renk seçimi eklenirse (örn. dropdown ile bir themeKey
// seçilirse), aşağıdaki hash yerine doğrudan o key ile THEMES[key] kullanılabilir; şu an
// listenin id'sine göre deterministik olarak seçiliyor (aynı liste her zaman aynı temayı alır).
const THEMES: ListTheme[] = [
  {
    accent: "#E64C66",
    accentSoft: "rgba(230, 76, 102, 0.16)",
    accentStrong: "#B8283F",
  }, // Crimson Reel
  {
    accent: "#2FD1E0",
    accentSoft: "rgba(47, 209, 224, 0.16)",
    accentStrong: "#1596A3",
  }, // Cyan Frame
  {
    accent: "#9B7BFF",
    accentSoft: "rgba(155, 123, 255, 0.16)",
    accentStrong: "#6C48D6",
  }, // Violet Static
  {
    accent: "#F2A93B",
    accentSoft: "rgba(242, 169, 59, 0.16)",
    accentStrong: "#C67F16",
  }, // Amber Marquee
  {
    accent: "#2ECC8F",
    accentSoft: "rgba(46, 204, 143, 0.16)",
    accentStrong: "#189A67",
  }, // Emerald Cut
  {
    accent: "#4A90E2",
    accentSoft: "rgba(74, 144, 226, 0.16)",
    accentStrong: "#2A63AE",
  }, // Steel Blue
];

export function getListTheme(id: string): ListTheme {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  return THEMES[hash % THEMES.length];
}

export const LIST_THEME_ACCENTS = THEMES.map((theme) => theme.accent);
export const getEntityTheme = getListTheme;
