using System.Text;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Users;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Watchlists;

public class WatchlistCsvTests
{
    [Theory]
    [InlineData("Name,Year\nSolaris,1972")]
    [InlineData("\uFEFFsep=;\r\nFilm Adı;Yıl\r\nSolaris;1972")]
    [InlineData("Title\tRelease Year\nSolaris\t1972")]
    public void Parse_RecognizesSupportedHeadersAndSeparators(string csv)
    {
        var parsed = WatchlistCsvParser.Parse(Encoding.UTF8.GetBytes(csv));
        Assert.Equal(0, parsed.InvalidRows);
        Assert.Equal(new WatchlistCsvRow(2, null, null, "Solaris", 1972), Assert.Single(parsed.Rows));
    }

    [Theory]
    [InlineData("")]
    [InlineData("Year\n1972")]
    [InlineData("Title\nA\0B")]
    public void Parse_RejectsUnreadableInput(string csv) =>
        Assert.Throws<ValidationException>(() => WatchlistCsvParser.Parse(Encoding.UTF8.GetBytes(csv)));

    [Fact]
    public void Parse_ReadsTurkishExcelEncoding()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        var bytes = Encoding.GetEncoding(1254).GetBytes("Başlık;Yıl\nÇığ;1990");
        Assert.Equal("Çığ", Assert.Single(WatchlistCsvParser.Parse(bytes).Rows).Title);
    }

    [Fact]
    public void Parse_EnforcesRowLimitIncludingInvalidRows()
    {
        var csv = "tmdb_id\n" + string.Concat(Enumerable.Repeat("0\n", 2000));
        Assert.Equal(2000, WatchlistCsvParser.Parse(Encoding.UTF8.GetBytes(csv)).InvalidRows);
        Assert.Throws<ValidationException>(() => WatchlistCsvParser.Parse(Encoding.UTF8.GetBytes(csv + "1\n")));
    }

    [Fact]
    public async Task Import_ResolvesIdsBeforeTitle_AccountsForEveryRow_AndCanBeRetried()
    {
        await using var db = TestDbContextFactory.Create();
        var first = new Movie { Title = "Solaris", OriginalTitle = "Solaris", ReleaseYear = 1972, ImdbId = "tt0069293" };
        var remake = new Movie { Title = "Solaris", OriginalTitle = "Solaris", ReleaseYear = 2002, TmdbId = 100 };
        db.Movies.AddRange(first, remake);
        await db.SaveChangesAsync();
        var owner = Guid.NewGuid();
        var csv = "title,year,imdb_id,tmdb_id\nSolaris,2002,tt0069293,100\nSolaris,1972,,\nSolaris,,,\nMissing,,,\n,2020,,\n,,,";
        var command = new ImportWatchlistCommand(owner, Encoding.UTF8.GetBytes(csv));
        var handler = new ImportWatchlistCommandHandler(db);
        var result = await handler.Handle(command, default);

        Assert.Equal((5, 1, 1, 1, 0), (result.TotalRows, result.Added, result.DuplicateRows,
            result.InvalidRows, result.AlreadyInWatchlist));
        Assert.Equal(new[] { (4, "Ambiguous"), (5, "NotFound") }, result.NotFound.Select(m => (m.Row, m.Reason)));
        Assert.Equal(first.Id, (await db.WatchlistItems.AsNoTracking().SingleAsync()).MovieId);
        var retry = await handler.Handle(command, default);
        Assert.Equal((0, 1), (retry.Added, retry.AlreadyInWatchlist));
        Assert.Equal(1, await db.WatchlistItems.CountAsync());
    }

    [Fact]
    public async Task Export_RoundTripsQuotedTitleAndIds_AndExcludesOtherUsers()
    {
        await using var db = TestDbContextFactory.Create();
        var movie = new Movie { Title = "@Çığ, \"Film\"", OriginalTitle = "Çığ", TmdbId = 12, ReleaseYear = 1990 };
        var other = new Movie { Title = "Other", OriginalTitle = "Other" };
        var owner = Guid.NewGuid();
        db.Movies.AddRange(movie, other);
        db.WatchlistItems.AddRange(new WatchlistItem { UserId = owner, MovieId = movie.Id },
            new WatchlistItem { UserId = Guid.NewGuid(), MovieId = other.Id });
        await db.SaveChangesAsync();
        var file = await new ExportWatchlistQueryHandler(db).Handle(new(owner), default);
        Assert.True(file.Content.AsSpan().StartsWith(Encoding.UTF8.GetPreamble()));
        Assert.Contains("\"'@Çığ, \"\"Film\"\"\"", Encoding.UTF8.GetString(file.Content));
        Assert.Equal(new WatchlistCsvRow(2, null, 12, movie.Title, 1990),
            Assert.Single(WatchlistCsvParser.Parse(file.Content).Rows));
    }
}
