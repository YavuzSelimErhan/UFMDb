using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;

namespace UFMDb.Application.Common;

/// <summary>Film listelerine kullanıcıya özel bayrakları (watchlist, tepki, izlenmiş) uygular.
/// Sadece verilen filmler için sorgular; sıra ve eleman sayısı korunur.</summary>
public static class MovieUserFlags
{
    public static async Task<List<MovieListItemDto>> ApplyAsync(
        IApplicationDbContext ctx, IReadOnlyList<MovieListItemDto> items, Guid userId, CancellationToken ct)
    {
        if (items.Count == 0) return new List<MovieListItemDto>();

        var movieIds = items.Select(i => i.Id).Distinct().ToList();

        var watchlistIds = (await ctx.WatchlistItems.AsNoTracking()
            .Where(w => w.UserId == userId && movieIds.Contains(w.MovieId))
            .Select(w => w.MovieId).ToListAsync(ct)).ToHashSet();

        var reactions = await ctx.Likes.AsNoTracking()
            .Where(l => l.UserId == userId && movieIds.Contains(l.MovieId))
            .ToDictionaryAsync(l => l.MovieId, l => l.Reaction, ct);

        var watchedIds = (await ctx.WatchHistory.AsNoTracking()
            .Where(w => w.UserId == userId && movieIds.Contains(w.MovieId))
            .Select(w => w.MovieId).ToListAsync(ct)).ToHashSet();

        // "İzlenmiş" = logu VEYA puanı olan film (her yerde aynı tanım)
        var ratedIds = await ctx.MovieRatings.AsNoTracking()
            .Where(r => r.UserId == userId && movieIds.Contains(r.MovieId))
            .Select(r => r.MovieId).ToListAsync(ct);
        watchedIds.UnionWith(ratedIds);

        return items.Select(i => (i with
        {
            IsInWatchlistByCurrentUser = watchlistIds.Contains(i.Id),
            IsWatchedByCurrentUser = watchedIds.Contains(i.Id)
        }).WithReaction(reactions)).ToList();
    }
}

public static class SqlLike
{
    public const string EscapeCharacter = @"\";

    /// <summary>ILIKE desenlerinde kullanıcı girdisindeki % ve _ karakterlerini literal yapar.</summary>
    public static string Escape(string s) =>
        s.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}