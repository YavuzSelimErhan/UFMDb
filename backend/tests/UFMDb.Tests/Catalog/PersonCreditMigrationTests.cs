using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Catalog;

public class PersonCreditMigrationTests
{
    [PostgresFact]
    public async Task Migration_MergesSharedIdentity_PreservesBothCreditsAndUnmatchedNames()
    {
        await using var db = PostgresDatabase.CreateContext();
        var migrator = db.GetService<IMigrator>();
        const string previous = "20261117112851_AddUserCoverMovie";
        try
        {
            await migrator.MigrateAsync(previous);
            var actor = new Actor { TmdbId = 17, FullName = "Shared" };
            var director = new Director { TmdbId = 17, FullName = "Shared", Biography = "Biography" };
            var film = new Movie { Title = "Test", OriginalTitle = "Test" };
            db.AddRange(actor, director, film, new Actor { FullName = "Same" }, new Director { FullName = "Same" });
            db.Add(new MovieActor { MovieId = film.Id, ActorId = actor.Id, CharacterName = "Lead", Order = 2 });
            db.Add(new MovieDirector { MovieId = film.Id, DirectorId = director.Id, Order = 1 });
            await db.SaveChangesAsync();

            await migrator.MigrateAsync("20261119120000_AddPeopleAndMovieCredits");
            var person = await db.People.SingleAsync(p => p.TmdbId == 17);
            Assert.Equal(actor.Id, person.LegacyActorId);
            Assert.Equal(director.Id, person.LegacyDirectorId);
            Assert.Equal("Biography", person.Biography);
            Assert.Equal(2, await db.People.CountAsync(p => p.FullName == "Same"));
            var credits = await db.MovieCredits.Where(c => c.PersonId == person.Id && c.MovieId == film.Id).ToListAsync();
            Assert.Equal(2, credits.Count);
            Assert.Contains(credits, c => c.Kind == CreditKind.Cast && c.CharacterName == "Lead" && c.Order == 2);
            Assert.Contains(credits, c => c.Kind == CreditKind.Crew && c.Job == "Director" && c.Order == 1);

            await migrator.MigrateAsync(previous);
            Assert.Equal(1, await db.Set<MovieActor>().CountAsync());
            Assert.Equal(1, await db.Set<MovieDirector>().CountAsync());
        }
        finally
        {
            await db.Database.EnsureDeletedAsync();
        }
    }
}
