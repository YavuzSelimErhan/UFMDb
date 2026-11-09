namespace UFMDb.Application.Features.Compatibility;

public static class CompatibilityCalculator
{
    public const int MinCommonCount = 5;
    private const double ConfidenceWeight = 5;  // k: nötr değere çekme gücü
    private const double MaxDiff = 4.5;         // 5.0 - 0.5

    public static int? Calculate(IReadOnlyCollection<(decimal Mine, decimal Theirs)> pairs)
    {
        var n = pairs.Count;
        if (n < MinCommonCount) return null;

        var similaritySum = pairs.Sum(p => 1.0 - (double)Math.Abs(p.Mine - p.Theirs) / MaxDiff);
        var score = (similaritySum + ConfidenceWeight * 0.5) / (n + ConfidenceWeight);

        return (int)Math.Round(score * 100, MidpointRounding.AwayFromZero);
    }
}