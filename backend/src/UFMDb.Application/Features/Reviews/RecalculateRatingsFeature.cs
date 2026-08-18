using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;

namespace UFMDb.Application.Features.Reviews;

/// <summary>
/// Tek seferlik bakım komutu: tüm filmlerin AverageRating'ini, MovieRatingRecalculator'daki
/// güncel Bayesian formülüyle (WatchHistory.Rating kaynaklı) yeniden hesaplar.
/// Formülün tek doğru kaynağı MovieRatingRecalculator'dır — burada tekrar yazılmaz.
/// </summary>
public record RecalculateAllRatingsCommand : IRequest<int>; // dönüş: güncellenen film sayısı

public class RecalculateAllRatingsCommandHandler : IRequestHandler<RecalculateAllRatingsCommand, int>
{
    private readonly IApplicationDbContext _context;
    public RecalculateAllRatingsCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<int> Handle(RecalculateAllRatingsCommand request, CancellationToken ct)
    {
        var movies = await _context.Movies.Where(m => !m.IsDeleted).ToListAsync(ct);

        foreach (var movie in movies)
        {
            await MovieRatingRecalculator.RecalculateAsync(_context, movie, ct);
        }

        return movies.Count;
    }
}