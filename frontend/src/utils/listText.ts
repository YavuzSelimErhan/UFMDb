/** Aktif dile göre metni seçer; o dildeki alan boşsa diğer dile düşer. */
export function pickListText(tr: string, en: string, lang: string): string {
  const isTr = lang.startsWith("tr");
  const primary = isTr ? tr : en;
  const fallback = isTr ? en : tr;
  return primary?.trim() ? primary : (fallback ?? "");
}
