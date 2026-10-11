/**
 * Bağımlılıksız göreli zaman ("2 saat önce", "dün", "3 hafta önce" yerine gün/ay).
 * FriendsActivitySection, ActivityPage ve NotificationBell aynı fonksiyonu kullanabilir.
 * Saat farkından dolayı gelecekteki zaman damgaları "şimdi" olarak gösterilir.
 */
export function timeAgo(iso: string, locale: string): string {
  const diffMin = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffMin < 1) return rtf.format(0, "minute");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return rtf.format(-diffDay, "day");
  return rtf.format(-Math.round(diffDay / 30), "month");
}
