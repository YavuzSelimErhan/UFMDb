using UFMDb.Application.Features.Compatibility;
using Xunit;

namespace UFMDb.Tests.Compatibility;

public class CompatibilityFilmSelectorTests
{
    private static RatedPair P(decimal mine, decimal theirs) => new(Guid.NewGuid(), mine, theirs);

    [Fact]
    public void Agreements_IncludesOnlyDifferencesUpToHalfStar()
    {
        var result = CompatibilityFilmSelector.Agreements(new[] { P(4.0m, 4.0m), P(4.0m, 3.5m), P(4.0m, 3.0m) });

        Assert.Equal(2, result.Count);
        Assert.All(result, p => Assert.True(p.Difference <= 0.5m));
    }

    [Fact]
    public void Agreements_PutsSharedFavouritesFirst()
    {
        var low = P(2.0m, 2.0m);    // ortalama 2.0
        var mid = P(4.0m, 4.0m);    // 4.0
        var high = P(5.0m, 4.5m);   // 4.75

        var result = CompatibilityFilmSelector.Agreements(new[] { low, mid, high });

        Assert.Equal(new[] { high.MovieId, mid.MovieId, low.MovieId }, result.Select(p => p.MovieId));
    }

    [Fact]
    public void Disagreements_IncludesOnlyOneStarOrMore_LargestFirst()
    {
        var small = P(4.0m, 3.5m);  // 0.5: dışarıda
        var one = P(4.0m, 3.0m);    // 1.0: içeride
        var big = P(5.0m, 2.0m);    // 3.0: içeride, başta

        var result = CompatibilityFilmSelector.Disagreements(new[] { small, one, big });

        Assert.Equal(new[] { big.MovieId, one.MovieId }, result.Select(p => p.MovieId));
    }

    [Fact]
    public void Lists_AreCappedAtSix()
    {
        var same = Enumerable.Range(0, 10).Select(_ => P(4.0m, 4.0m)).ToList();
        var apart = Enumerable.Range(0, 10).Select(_ => P(5.0m, 1.0m)).ToList();

        Assert.Equal(6, CompatibilityFilmSelector.Agreements(same).Count);
        Assert.Equal(6, CompatibilityFilmSelector.Disagreements(apart).Count);
    }

    [Fact]
    public void Lists_NeverOverlap()
    {
        var pairs = new[] { P(4.0m, 4.0m), P(4.0m, 3.5m), P(4.0m, 3.0m), P(5.0m, 1.0m), P(0.5m, 0.5m) };

        var agreements = CompatibilityFilmSelector.Agreements(pairs).Select(p => p.MovieId);
        var disagreements = CompatibilityFilmSelector.Disagreements(pairs).Select(p => p.MovieId);

        Assert.Empty(agreements.Intersect(disagreements));
    }

    [Fact]
    public void AverageDifference_NoPairs_ReturnsNull()
    {
        Assert.Null(CompatibilityFilmSelector.AverageDifference(Array.Empty<RatedPair>()));
    }

    [Fact]
    public void AverageDifference_RoundsToOneDecimal()
    {
        // Farklar: 0.5, 1.0, 0.5, 1.0, 0.5, 0.5, 1.0 → toplam 5.0 / 7 = 0.714
        var pairs = new[]
        {
            P(4.0m, 3.5m), P(4.0m, 3.0m), P(3.0m, 3.5m), P(5.0m, 4.0m),
            P(2.0m, 2.5m), P(4.5m, 4.0m), P(3.0m, 2.0m),
        };

        Assert.Equal(0.7m, CompatibilityFilmSelector.AverageDifference(pairs));
    }
}