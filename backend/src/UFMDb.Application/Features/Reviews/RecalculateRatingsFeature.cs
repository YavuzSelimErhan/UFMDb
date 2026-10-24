using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;

namespace UFMDb.Application.Features.Reviews;

/// <summary>
/// Tek seferlik bakım komutu: tüm filmlerin AverageRating/RatingCount alanlarını MovieRatings
/// tablosundan ve MovieRatingRecalculator formülüyle yeniden hesaplar. Tek toplu sorgu + tek SaveChanges.
/// Formülün tek doğru kaynağı MovieRatingRecalculator.ApplyStats'tır.
/// </summary>
public record RecalculateAllRatingsCommand : IRequest<int>; // dönüş: güncellenen film sayısı

public class RecalculateAllRatingsCommandHandler : IRequestHandler<RecalculateAllRatingsCommand, int>
{
    private readonly IApplicationDbContext _context;
    public RecalculateAllRatingsCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<int> Handle(RecalculateAllRatingsCommand request, CancellationToken ct)
    {
        var stats = await _context.MovieRatings.AsNoTracking()
            .GroupBy(r => r.MovieId)
            .Select(g => new { MovieId = g.Key, Sum = g.Sum(r => (double)r.Value), Count = g.Count() })
            .ToDictionaryAsync(x => x.MovieId, ct);

        var movies = await _context.Movies.Where(m => !m.IsDeleted).ToListAsync(ct);

        foreach (var movie in movies)
        {
            if (stats.TryGetValue(movie.Id, out var s))
                MovieRatingRecalculator.ApplyStats(movie, s.Count, s.Sum);
            else
                MovieRatingRecalculator.ApplyStats(movie, 0, 0);
        }

        await _context.SaveChangesAsync(ct);
        return movies.Count;
    }
}