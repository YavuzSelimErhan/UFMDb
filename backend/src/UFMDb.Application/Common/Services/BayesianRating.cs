using Microsoft.EntityFrameworkCore;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Common.Services;

/// <summary>
/// IMDb tarzı ağırlıklı puan (Bayesian average): az oylu filmleri genel ortalamaya
/// doğru çeker, böylece 1 oyla 5.0 alan bir film 5000 oyla 4.6 alan filmi geçemez.
/// Ekranda hep gerçek AverageRating gösterilir — bu sadece SIRALAMA için.
/// </summary>
public static class BayesianRating
{
    /// <summary>"m" — minimum oy eşiği. Büyüdükçe az oylu filmler daha çok bastırılır.</summary>
    public const int MinVotesForRanking = 30;

    /// <summary>"C" — referans alınan genel ortalama puan (oy almış filmler üzerinden).</summary>
    public static async Task<double> GetGlobalAverageAsync(IQueryable<Movie> moviesWithVotes, CancellationToken ct)
        => await moviesWithVotes.Select(m => (double?)m.AverageRating).AverageAsync(ct) ?? 0.0;
}