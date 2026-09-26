using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Common.Services;

public static class MovieRatingRecalculator
{
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

    /// <summary>Filmin AverageRating/RatingCount alanlarını yeniden hesaplar. TMDB'den içe aktarılan
    /// orijinal oy sayısı (SeedVoteCount) ve ortalaması (SeedRating) hiç silinmez; sitede verilen
    /// yeni puanlar bunun üzerine, gerçek oy sayılarıyla ağırlıklandırılarak eklenir. Tek doğru
    /// kaynak burasıdır — TmdbImporter'daki tek seferlik backfill de aynı mantığı izler.</summary>
    public static async Task RecalculateAsync(IApplicationDbContext context, Movie movie, CancellationToken ct)
    {
        var stats = await context.MovieRatings
            .Where(r => r.MovieId == movie.Id)
            .GroupBy(r => r.MovieId)
            .Select(g => new { Sum = g.Sum(r => (double)r.Value), Count = g.Count() })
            .FirstOrDefaultAsync(ct);

        var localCount = stats?.Count ?? 0;
        var localSum = stats?.Sum ?? 0;

        var totalVotes = movie.SeedVoteCount + localCount;

        movie.AverageRating = totalVotes == 0
            ? movie.SeedRating
            : Math.Round((movie.SeedRating * movie.SeedVoteCount + localSum) / totalVotes, 2);

        movie.RatingCount = totalVotes;

        await context.SaveChangesAsync(ct);
    }
}