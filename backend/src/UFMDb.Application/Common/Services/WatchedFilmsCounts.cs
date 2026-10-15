namespace UFMDb.Application.Common.Services;

public record WatchedFilmsCountsDto(int All, int Rated, int Unrated);

public static class WatchedFilmsCounter
{
    /// <summary>
    /// "İzlenen film" = WatchHistory'de kaydı olan VEYA MovieRatings'te puanı olan distinct film.
    /// Profil, public profil, counts endpoint'i ve Films listesi aynı tanımı kullanır.
    /// </summary>
    public static WatchedFilmsCountsDto From(IEnumerable<Guid> watchedMovieIds, IEnumerable<Guid> ratedMovieIds)
    {
        var rated = ratedMovieIds.ToHashSet();
        var all = watchedMovieIds.ToHashSet();
        all.UnionWith(rated);
        return new WatchedFilmsCountsDto(all.Count, rated.Count, all.Count - rated.Count);
    }
}