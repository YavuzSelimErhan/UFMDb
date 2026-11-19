using Microsoft.EntityFrameworkCore;
using UFMDb.Domain.Entities;
using UFMDb.Persistence;
using UFMDb.Tests.TestHelpers;
using UFMDb.Tools.TmdbImporter;
using UFMDb.Tools.TmdbImporter.Models;
using Xunit;

namespace UFMDb.Tests.Catalog;

public class ArchiveCreditBackfillTests
{
    [PostgresFact]
    public async Task BatchResumeAndRetry_VisitOnlyEligibleFilms()
    {
        await using var db = PostgresDatabase.CreateContext();
        try
        {
            await db.Database.EnsureCreatedAsync();
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(db.Database.GetConnectionString()).Options;
            for (int id = 1; id <= 4; id++)
                db.Movies.Add(new Movie { Title = $"Film {id}", OriginalTitle = $"Film {id}", TmdbId = id });
            await db.SaveChangesAsync();
            var seen = new List<int>();
            bool failSecond = true;
            var secondStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            async Task<TmdbMovieDetail?> Fetch(int id, CancellationToken ct)
            {
                seen.Add(id);
                if (id == 1) await secondStarted.Task.WaitAsync(TimeSpan.FromSeconds(5), ct);
                if (id == 2 && failSecond)
                {
                    secondStarted.TrySetResult(true);
                    throw new HttpRequestException();
                }
                return new TmdbMovieDetail
                {
                    Id = id,
                    Credits = new TmdbCredits
                    {
                        Cast = new(),
                        Crew = new() { new() { Id = 17, Name = "Writer", Job = "Writer",
                            CreditId = $"writer-{id}", Department = "Writing" } }
                    }
                };
            }
            Assert.Equal(1, await ArchiveCreditBackfill.RunAsync(options, Fetch, new[] { "--once", "--batch-size", "2", "--parallel", "2" }, default));
            Assert.Equal(new[] { 1, 2 }, seen);
            seen.Clear();
            Assert.Equal(0, await ArchiveCreditBackfill.RunAsync(options, Fetch, Array.Empty<string>(), default));
            Assert.Equal(new[] { 3, 4 }, seen);
            seen.Clear();
            failSecond = false;
            Assert.Equal(0, await ArchiveCreditBackfill.RunAsync(options, Fetch, new[] { "--retry-failed" }, default));
            Assert.Equal(new[] { 2 }, seen);
            seen.Clear();
            Assert.Equal(0, await ArchiveCreditBackfill.RunAsync(options, Fetch, Array.Empty<string>(), default));
            Assert.Empty(seen);
            Assert.Equal(4, await db.MovieCredits.CountAsync());
            Assert.Equal(1, await db.People.CountAsync());
        }
        finally { await db.Database.EnsureDeletedAsync(); }
    }
}
