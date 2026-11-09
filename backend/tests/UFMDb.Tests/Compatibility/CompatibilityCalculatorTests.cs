using UFMDb.Application.Features.Compatibility;
using Xunit;

namespace UFMDb.Tests.Compatibility;

public class CompatibilityCalculatorTests
{
    private static List<(decimal Mine, decimal Theirs)> Repeat(decimal mine, decimal theirs, int count) =>
        Enumerable.Repeat((Mine: mine, Theirs: theirs), count).ToList();

    // --- Eşik ---

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    public void Calculate_BelowMinimum_ReturnsNull(int count)
    {
        var result = CompatibilityCalculator.Calculate(Repeat(4.0m, 4.0m, count));

        Assert.Null(result);
    }

    [Fact]
    public void Calculate_ExactlyAtMinimum_ReturnsScore()
    {
        var result = CompatibilityCalculator.Calculate(
            Repeat(4.0m, 4.0m, CompatibilityCalculator.MinCommonCount));

        Assert.NotNull(result);
    }

    // --- Tam uyum: (n + 2.5) / (n + 5) ---

    [Theory]
    [InlineData(5, 75)]    // 7.5 / 10
    [InlineData(10, 83)]   // 12.5 / 15 = 0.8333
    [InlineData(20, 90)]   // 22.5 / 25
    [InlineData(50, 95)]   // 52.5 / 55 = 0.9545
    public void Calculate_IdenticalRatings_FollowsConfidenceCurve(int count, int expected)
    {
        var result = CompatibilityCalculator.Calculate(Repeat(3.5m, 3.5m, count));

        Assert.Equal(expected, result);
    }

    // --- Tam zıtlık (5.0 vs 0.5): 2.5 / (n + 5) ---

    [Theory]
    [InlineData(5, 25)]    // 2.5 / 10
    [InlineData(50, 5)]    // 2.5 / 55 = 0.0455
    public void Calculate_MaximumDisagreement_FollowsConfidenceCurve(int count, int expected)
    {
        var result = CompatibilityCalculator.Calculate(Repeat(5.0m, 0.5m, count));

        Assert.Equal(expected, result);
    }

    // --- Elle doğrulanmış ara değerler ---

    [Fact]
    public void Calculate_MixedDifferences_MatchesHandComputedValue()
    {
        // Farklar: 0, 0.5, 1.0, 1.5, 2.0 → benzerlikler toplamı = 5 - 5.0/4.5 = 3.8889
        // (3.8889 + 2.5) / 10 = 0.6389 → 64
        var pairs = new List<(decimal Mine, decimal Theirs)>
        {
            (4.0m, 4.0m),
            (4.0m, 3.5m),
            (4.0m, 3.0m),
            (4.0m, 2.5m),
            (4.0m, 2.0m),
        };

        Assert.Equal(64, CompatibilityCalculator.Calculate(pairs));
    }

    [Fact]
    public void Calculate_SingleHalfPointDifference_LowersScoreSlightly()
    {
        // Benzerlikler toplamı = 4 + (1 - 0.5/4.5) = 4.8889
        // (4.8889 + 2.5) / 10 = 0.7389 → 74
        var pairs = Repeat(4.0m, 4.0m, 4);
        pairs.Add((4.0m, 3.5m));

        Assert.Equal(74, CompatibilityCalculator.Calculate(pairs));
    }

    // --- Özellikler ---

    [Fact]
    public void Calculate_IsSymmetric()
    {
        var pairs = new List<(decimal Mine, decimal Theirs)>
        {
            (5.0m, 3.0m), (2.5m, 4.0m), (4.5m, 4.5m), (1.0m, 3.5m), (3.0m, 0.5m), (4.0m, 5.0m),
        };
        var swapped = pairs.Select(p => (Mine: p.Theirs, Theirs: p.Mine)).ToList();

        Assert.Equal(
            CompatibilityCalculator.Calculate(pairs),
            CompatibilityCalculator.Calculate(swapped));
    }

    [Fact]
    public void Calculate_MoreCommonFilms_RaisesScoreForPerfectMatch()
    {
        var s5 = CompatibilityCalculator.Calculate(Repeat(4.0m, 4.0m, 5));
        var s10 = CompatibilityCalculator.Calculate(Repeat(4.0m, 4.0m, 10));
        var s50 = CompatibilityCalculator.Calculate(Repeat(4.0m, 4.0m, 50));

        Assert.True(s5 < s10);
        Assert.True(s10 < s50);
    }

    [Fact]
    public void Calculate_AlwaysStaysWithinZeroAndHundred()
    {
        var extremes = new[]
        {
            Repeat(5.0m, 5.0m, 200),
            Repeat(5.0m, 0.5m, 200),
            Repeat(0.5m, 5.0m, 5),
            Repeat(0.5m, 0.5m, 5),
        };

        foreach (var pairs in extremes)
        {
            var result = CompatibilityCalculator.Calculate(pairs);
            Assert.NotNull(result);
            Assert.InRange(result!.Value, 0, 100);
        }
    }
}