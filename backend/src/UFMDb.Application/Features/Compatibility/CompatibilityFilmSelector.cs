namespace UFMDb.Application.Features.Compatibility;

/// <summary>İki kullanıcının aynı filme verdiği puanlar.</summary>
public readonly record struct RatedPair(Guid MovieId, decimal Mine, decimal Theirs)
{
    public decimal Difference => Math.Abs(Mine - Theirs);
    public decimal Average => (Mine + Theirs) / 2m;
}

public static class CompatibilityFilmSelector
{
    public const decimal AgreementMaxDifference = 0.5m;
    public const decimal DisagreementMinDifference = 1.0m;
    public const int MaxPerList = 6;

    /// <summary>Benzer puan verilen filmler; ikisinin de çok sevdikleri başta.</summary>
    public static List<RatedPair> Agreements(IEnumerable<RatedPair> pairs) =>
        pairs.Where(p => p.Difference <= AgreementMaxDifference)
            .OrderByDescending(p => p.Average)
            .ThenBy(p => p.MovieId)
            .Take(MaxPerList)
            .ToList();

    /// <summary>Puanı belirgin ayrışan filmler; en büyük fark başta.</summary>
    public static List<RatedPair> Disagreements(IEnumerable<RatedPair> pairs) =>
        pairs.Where(p => p.Difference >= DisagreementMinDifference)
            .OrderByDescending(p => p.Difference)
            .ThenBy(p => p.MovieId)
            .Take(MaxPerList)
            .ToList();

    /// <summary>Tüm ortak filmlerde ortalama puan farkı (yıldız); ortak film yoksa null.</summary>
    public static decimal? AverageDifference(IReadOnlyCollection<RatedPair> pairs) =>
        pairs.Count == 0
            ? null
            : Math.Round(pairs.Average(p => p.Difference), 1, MidpointRounding.AwayFromZero);
}