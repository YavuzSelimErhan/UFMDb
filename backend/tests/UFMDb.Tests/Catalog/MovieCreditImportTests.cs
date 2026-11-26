using Microsoft.EntityFrameworkCore;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using UFMDb.Tools.TmdbImporter;
using UFMDb.Tools.TmdbImporter.Models;
using Xunit;

namespace UFMDb.Tests.Catalog;

public class MovieCreditImportTests
{
    [Fact]
    public async Task RepeatImport_ReusesMigratedRowsAndPreservesMissingCredits()
    {
        await using var db = TestDbContextFactory.Create();
        var film = new Movie { Title = "Film", OriginalTitle = "Film" };
        var actor = new Actor { TmdbId = 17, FullName = "Shared" };
        var director = new Director { TmdbId = 17, FullName = "Shared" };
        var person = new Person { TmdbId = 17, FullName = "Shared" };
        var cast = new MovieCredit { MovieId = film.Id, PersonId = person.Id, Kind = CreditKind.Cast, Job = "Actor" };
        var directing = new MovieCredit { MovieId = film.Id, PersonId = person.Id, Kind = CreditKind.Crew, Job = "Director" };
        var existingExtra = new MovieCredit { MovieId = film.Id, PersonId = person.Id, Kind = CreditKind.Crew,
            Job = "Assistant Camera", TmdbCreditId = "previous-pilot-credit" };
        db.AddRange(film, actor, director, person, cast, directing, existingExtra);
        db.Add(new MovieActor { MovieId = film.Id, ActorId = actor.Id, Order = 16 });
        await db.SaveChangesAsync();
        var payload = new TmdbCredits
        {
            Cast = new() { new() { Id = 17, Name = "Shared", CreditId = "cast", Character = "Lead", Order = 16 },
                new() { Id = 91, Name = "Outside roster", CreditId = "extra", Order = 0 } },
            Crew = new()
            {
                new() { Id = 17, Name = "Shared", CreditId = "direct", Department = "Directing", Job = "Director" },
                new() { Id = 17, Name = "Shared", CreditId = "write", Department = "Writing", Job = "Screenplay" },
                new() { Id = 23, Name = "Composer", CreditId = "music", Department = "Sound", Job = "Original Music Composer" },
                new() { Id = 92, Name = "Assistant", CreditId = "assistant", Department = "Camera", Job = "Assistant Camera" }
            }
        };
        var merged = await MovieCreditImport.MergeAsync(db, film.Id, payload, default);
        var ids = await db.MovieCredits.Select(c => c.TmdbCreditId ?? "(null)").ToListAsync();
        Assert.True(merged == 2, $"merged={merged}; credits=[{string.Join(", ", ids)}]");
        db.ChangeTracker.Clear();
        Assert.Equal(0, await MovieCreditImport.MergeAsync(db, film.Id, payload, default));
        payload.Crew.RemoveAt(2);
        Assert.Equal(0, await MovieCreditImport.MergeAsync(db, film.Id, payload, default));
        var shared = await db.People.SingleAsync(p => p.Id == person.Id);
        Assert.Equal(actor.Id, shared.LegacyActorId);
        Assert.Equal(director.Id, shared.LegacyDirectorId);
        Assert.Equal(2, await db.People.CountAsync());
        Assert.Equal(5, await db.MovieCredits.CountAsync());
        Assert.True(await db.MovieCredits.AnyAsync(c => c.Id == existingExtra.Id));
        Assert.Equal(cast.Id, (await db.MovieCredits.SingleAsync(x => x.TmdbCreditId == "cast")).Id);
        Assert.Equal(directing.Id, (await db.MovieCredits.SingleAsync(x => x.TmdbCreditId == "direct")).Id);
        await Assert.ThrowsAsync<InvalidDataException>(() => MovieCreditImport.MergeAsync(db, film.Id, null, default));
    }
}
