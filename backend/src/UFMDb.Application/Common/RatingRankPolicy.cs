namespace UFMDb.Application.Common;

/// <summary>
/// Site genelindeki "en yüksek puanlı" sıralamalarında (arama, ana sayfa hero/Top Rated,
/// profil sıralaması) bir filmin üste çıkabilmesi için gereken en az toplam oy sayısı.
/// RatingCount = SeedVoteCount (TMDB) + sitedeki kullanıcı oyları olduğundan eşik her ikisini de
/// kapsar. Az oyla (ör. 1 oyla 5 yıldız) öne çıkmayı engeller.
/// </summary>
public static class RatingRankPolicy
{
    public const int MinVotesForRatingRank = 10000;
}
