using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Features.Users;

internal static class ScreeningRatingSync
{
    public sealed record RatedScreening(Guid Id, decimal Value);

    public static Task<RatedScreening?> LatestAsync(IApplicationDbContext ctx, Guid movieId, Guid userId, CancellationToken ct) =>
        ctx.WatchHistory.AsNoTracking()
            .Where(w => w.MovieId == movieId && w.UserId == userId && w.Rating.HasValue)
            .OrderByDescending(w => w.WatchedAtUtc.Date)
            .ThenByDescending(w => w.CreatedAtUtc)
            .ThenByDescending(w => w.Id)
            .Select(w => new RatedScreening(w.Id, w.Rating!.Value))
            .FirstOrDefaultAsync(ct);

    public static async Task ApplyChangeAsync(IApplicationDbContext ctx, Movie movie, Guid userId,
        RatedScreening? before, CancellationToken ct)
    {
        var after = await LatestAsync(ctx, movie.Id, userId, ct);
        if (before == after) return;

        var current = await ctx.MovieRatings.AsNoTracking()
            .Where(r => r.UserId == userId && r.MovieId == movie.Id)
            .Select(r => (decimal?)r.Value).FirstOrDefaultAsync(ct);
        if (current == after?.Value) return;

        // Removing a diary rating must preserve a separately changed current opinion.
        if (before is not null && current != before.Value) return;

        if (after is not null)
            await MovieRatingRecalculator.UpsertCurrentRatingAsync(ctx, movie, userId, after.Value, ct);
        else
            await MovieRatingRecalculator.RemoveCurrentRatingAsync(ctx, movie, userId, ct);
    }
}
