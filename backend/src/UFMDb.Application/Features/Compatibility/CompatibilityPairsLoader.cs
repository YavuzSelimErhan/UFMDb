using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;

namespace UFMDb.Application.Features.Compatibility;

internal static class CompatibilityPairsLoader
{
    public static async Task<List<RatedPair>> LoadAsync(
        IApplicationDbContext context, Guid viewerId, Guid targetId, CancellationToken ct)
    {
        var rows = await (
            from a in context.MovieRatings
            join b in context.MovieRatings on a.MovieId equals b.MovieId
            where a.UserId == viewerId && b.UserId == targetId
            select new { a.MovieId, Mine = a.Value, Theirs = b.Value }
        ).AsNoTracking().ToListAsync(ct);

        return rows.Select(r => new RatedPair(r.MovieId, r.Mine, r.Theirs)).ToList();
    }
}