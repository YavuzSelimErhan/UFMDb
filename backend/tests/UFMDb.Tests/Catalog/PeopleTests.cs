using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.People;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Catalog;

public class PersonTests
{
    [Fact]
    public async Task PersonDetails_MergeRolesPerFilm_SortByPopularity_AndShowOnlyViewersPersonalFlags()
    {
        await using var db = TestDbContextFactory.Create();
        var person = new Person { FullName = "Auteur" };
        var older = new Movie { Title = "Early", OriginalTitle = "Early", ReleaseYear = 1960, TmdbPopularity = 5 };
        var newer = new Movie { Title = "Late", OriginalTitle = "Late", ReleaseYear = 1980, TmdbPopularity = 50 };
        var viewer = Guid.NewGuid();
        db.People.Add(person);
        db.Movies.AddRange(older, newer);
        db.MovieCredits.AddRange(
            new MovieCredit { MovieId = older.Id, PersonId = person.Id, Kind = CreditKind.Cast, Department = "Acting", Job = "Actor" },
            new MovieCredit { MovieId = newer.Id, PersonId = person.Id, Kind = CreditKind.Cast, Department = "Acting", Job = "Actor" },
            new MovieCredit { MovieId = newer.Id, PersonId = person.Id, Kind = CreditKind.Crew, Department = "Directing", Job = "Director" });
        db.WatchlistItems.Add(new WatchlistItem { UserId = viewer, MovieId = older.Id });
        await db.SaveChangesAsync();

        var like = new TogglePersonLikeHandler(db);
        Assert.True(await like.Handle(new(person.Id, viewer), default));

        var details = new GetPersonHandler(db);
        var mine = await details.Handle(new(person.Id, "en", viewer), default);
        Assert.True(mine.IsLikedByCurrentUser);
        Assert.Equal(1, mine.LikeCount);
        Assert.Equal(new[] { newer.Id, older.Id }, mine.Films.Select(f => f.Movie.Id));
        Assert.Equal(new[] { "Cast", "Director" }, mine.Films[0].Roles);
        Assert.Equal(new[] { "Cast" }, mine.Films[1].Roles);
        Assert.True(mine.Films[1].Movie.IsInWatchlistByCurrentUser);

        var guest = await details.Handle(new(person.Id, "en", null), default);
        Assert.False(guest.IsLikedByCurrentUser);
        Assert.False(guest.Films[1].Movie.IsInWatchlistByCurrentUser);

        Assert.False(await like.Handle(new(person.Id, viewer), default));
        Assert.Equal(0, (await details.Handle(new(person.Id, "en", viewer), default)).LikeCount);

        person.IsDeleted = true;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<NotFoundException>(() => details.Handle(new(person.Id, "en", viewer), default));
    }

    [Fact]
    public async Task PersonAdmin_EditsAreReflectedInDetails_AndDeletedPersonIsHidden()
    {
        await using var db = TestDbContextFactory.Create();
        var id = await new CreatePersonHandler(db).Handle(new("Director", null, "", "", ""), default);
        var viewer = Guid.NewGuid();
        var like = new TogglePersonLikeHandler(db);
        await like.Handle(new(id, viewer), default);
        await new UpdatePersonHandler(db).Handle(new(id, "Updated", null, "Bio", "", "TR"), default);

        var details = new GetPersonHandler(db);
        var saved = await details.Handle(new(id, "en", viewer), default);
        Assert.Equal(("Updated", "Bio", "TR", 1, true),
            (saved.FullName, saved.Biography, saved.Nationality, saved.LikeCount, saved.IsLikedByCurrentUser));

        Assert.False(await like.Handle(new(id, viewer), default));
        Assert.Equal(0, (await details.Handle(new(id, "en", viewer), default)).LikeCount);

        await new DeletePersonHandler(db).Handle(new(id), default);
        await Assert.ThrowsAsync<NotFoundException>(() => details.Handle(new(id, "en", null), default));
    }
}