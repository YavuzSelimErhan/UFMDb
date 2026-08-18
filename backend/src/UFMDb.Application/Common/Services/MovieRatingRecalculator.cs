using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Common.Services;

/// <summary>
/// Bir filmin AverageRating/RatingCount alanlarını, her kullanıcının EN SON puanladığı
/// seansına göre yeniden hesaplar. Aynı filmi birden fazla kez izleyip farklı puanlar
/// verilse bile, ortalamaya sadece en güncel (en son tarihli) puan katılır.
/// </summary>
public static class MovieRatingRecalculator
{
    private const int MinVotesForFullWeight = 50;

    public static async Task RecalculateAsync(IApplicationDbContext context, Movie movie, CancellationToken ct)
    {
        var ratedEntries = await context.WatchHistory.AsNoTracking()
            .Where(w => w.MovieId == movie.Id && w.Rating != null)
            .Select(w => new { w.UserId, w.WatchedAtUtc, Rating = w.Rating!.Value })
            .ToListAsync(ct);

        var latestPerUser = ratedEntries
            .GroupBy(e => e.UserId)
            .Select(g => (double)g.OrderByDescending(e => e.WatchedAtUtc).First().Rating)
            .ToList();

        var voteCount = latestPerUser.Count;
        var avg = voteCount == 0 ? 0 : latestPerUser.Average();
        var weighted = voteCount == 0
            ? movie.SeedRating
            : ((double)voteCount / (voteCount + MinVotesForFullWeight)) * avg
              + ((double)MinVotesForFullWeight / (voteCount + MinVotesForFullWeight)) * movie.SeedRating;

        movie.AverageRating = Math.Round(weighted, 2);
        movie.RatingCount = movie.SeedVoteCount + voteCount;
        await context.SaveChangesAsync(ct);
    }
}