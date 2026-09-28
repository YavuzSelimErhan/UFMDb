// Beta uyarısında (BetaNotice) gösterilen geri bildirim kanalları.
// Boş bırakılan alanlar arayüzde hiç gösterilmez; yeni bir adres eklemek için
// sadece burayı doldurman yeterli.
export const CONTACT = {
  // Örn: "iletisim@ufmdb.com" — domain e-postası hazır olunca doldur.
  email: "iletisim@ufmdb.com",
  // Hata / öneri bildirimi için GitHub Issues sayfası.
  githubIssuesUrl: "https://github.com/YavuzSelimErhan/UFMDb/issues",
} as const;
