using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Common.Services;

public static class MovieRatingRecalculator
{
    private const int MinVotesForFullWeight = 50;

    /// <summary>Kullanıcının bir filme dair güncel puanını set eder (hızlı puan veya seans defteri
    /// kaydından çağrılır) ve ardından filmin AverageRating'ini yeniden hesaplar.</summary>
    public static async Task UpsertCurrentRatingAsync(IApplicationDbContext context, Movie movie, Guid userId, decimal value, CancellationToken ct)
    {
        var existing = await context.MovieRatings
            .FirstOrDefaultAsync(r => r.MovieId == movie.Id && r.UserId == userId, ct);

        if (existing is null)
        {
            context.MovieRatings.Add(new MovieRating { MovieId = movie.Id, UserId = userId, Value = value });
        }
        else
        {
            existing.Value = value;
            existing.UpdatedAtUtc = DateTime.UtcNow;
        }

        await context.SaveChangesAsync(ct);
        await RecalculateAsync(context, movie, ct);
    }

    /// <summary>Filmin AverageRating/RatingCount alanlarını, MovieRatings tablosundaki
    /// (SeedRating'e göre ağırlıklandırılmış) puanlarla yeniden hesaplar. Tek doğru kaynak burasıdır.</summary>
    public static async Task RecalculateAsync(IApplicationDbContext context, Movie movie, CancellationToken ct)
    {
        var stats = await context.MovieRatings
            .Where(r => r.MovieId == movie.Id)
            .GroupBy(r => r.MovieId)
            .Select(g => new { Avg = g.Average(r => (double)r.Value), Count = g.Count() })
            .FirstOrDefaultAsync(ct);

        var voteCount = stats?.Count ?? 0;

        movie.AverageRating = voteCount == 0
            ? movie.SeedRating
            : Math.Round(
                ((double)voteCount / (voteCount + MinVotesForFullWeight)) * stats!.Avg
                + ((double)MinVotesForFullWeight / (voteCount + MinVotesForFullWeight)) * movie.SeedRating,
                2);

        movie.RatingCount = voteCount;

        await context.SaveChangesAsync(ct);
    }
}