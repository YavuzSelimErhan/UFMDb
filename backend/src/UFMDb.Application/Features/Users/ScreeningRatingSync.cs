using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Features.Users;

internal static class ScreeningRatingSync
{
    /// <summary>MovieRatings'i en son puanlı seansla eşitler; puanlı seans yoksa satırı kaldırır.</summary>
    public static async Task SyncAsync(IApplicationDbContext ctx, Movie movie, Guid userId, CancellationToken ct)
    {
        var latest = await ctx.WatchHistory.AsNoTracking()
            .Where(w => w.MovieId == movie.Id && w.UserId == userId && w.Rating.HasValue)
            .OrderByDescending(w => w.WatchedAtUtc).ThenByDescending(w => w.Id)
            .Select(w => w.Rating)
            .FirstOrDefaultAsync(ct);

        if (latest.HasValue)
            await MovieRatingRecalculator.UpsertCurrentRatingAsync(ctx, movie, userId, latest.Value, ct);
        else
            await MovieRatingRecalculator.RemoveCurrentRatingAsync(ctx, movie, userId, ct);
    }
}