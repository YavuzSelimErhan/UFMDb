namespace UFMDb.Application.Common;

/// <summary>
/// Site genelinde "en yüksek puanlı" sıralamalarının (film arama sayfası, ana sayfa hero
/// carousel + Top Rated bölümü, profildeki "en yüksek puanlı" film sıralaması vb.) ortak
/// kuralı: bir filmin bu sıralamalarda üste çıkabilmesi için en az bu kadar gerçek kullanıcı
/// oyu olması gerekir. Eşiğin altındaki filmler (ör. 1 oyla 5 yıldız alan yeni bir film)
/// AverageRating'i ne olursa olsun listenin altına düşer.
///
/// Bu, MovieRatingRecalculator'daki Bayesian ortalamayı (MinVotesForFullWeight = 50)
/// değiştirmez/bastırmaz — o film detayında gösterilen puanı yumuşatır. Buradaki eşik ise
/// sadece "az veriyle öne çıkma" sıralama hilesini engelleyen ayrı bir kapı; ikisi birlikte
/// çalışır.
/// </summary>
public static class RatingRankPolicy
{
    public const int MinVotesForRatingRank = 10;
}
