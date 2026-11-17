namespace UFMDb.Application.Common.Services;

public record WatchedFilmsCountsDto(int All, int Rated, int Unrated, int? ThisYear = null);

public static class WatchedFilmsCounter
{
    /// <summary>
    /// "İzlenen film" = WatchHistory'de kaydı olan VEYA MovieRatings'te puanı olan distinct film.
    /// Profil, public profil, counts endpoint'i ve Films listesi aynı tanımı kullanır.
    /// </summary>
    public static WatchedFilmsCountsDto From(
        IEnumerable<Guid> watchedMovieIds, IEnumerable<Guid> ratedMovieIds, int? thisYear = null)
    {
        var rated = ratedMovieIds.ToHashSet();
        var all = watchedMovieIds.ToHashSet();
        all.UnionWith(rated);
        return new WatchedFilmsCountsDto(all.Count, rated.Count, all.Count - rated.Count, thisYear);
    }

    /// <summary>
    /// Bu yıl izlenen distinct film: bu yıl WatchHistory kaydı olanlar + hiç WatchHistory kaydı
    /// olmayıp puanı bu yıl verilmiş olanlar (defter listesindeki tarih mantığıyla tutarlı).
    /// </summary>
    public static int CountThisYear(
        IEnumerable<(Guid MovieId, DateTime WatchedAtUtc)> watchEntries,
        IEnumerable<(Guid MovieId, DateTime RatedAtUtc)> ratings,
        int year)
    {
        var entries = watchEntries.ToList();
        var ids = entries.Where(w => w.WatchedAtUtc.Year == year).Select(w => w.MovieId).ToHashSet();
        var everLogged = entries.Select(w => w.MovieId).ToHashSet();

        foreach (var r in ratings)
            if (r.RatedAtUtc.Year == year && !everLogged.Contains(r.MovieId))
                ids.Add(r.MovieId);

        return ids.Count;
    }
}