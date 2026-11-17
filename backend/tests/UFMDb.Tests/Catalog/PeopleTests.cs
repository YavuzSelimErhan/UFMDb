using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Actors;
using UFMDb.Application.Features.Directors;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Catalog;

public class PeopleTests
{
    [Fact]
    public async Task ActorDetails_SortCreditsAndShowOnlyViewersPersonalFlags()
    {
        await using var db = TestDbContextFactory.Create();
        var actor = await new CreateActorCommandHandler(db).Handle(new("Performer", null, "", "", ""), default);
        var older = new Movie { Title = "Early", OriginalTitle = "Early", ReleaseYear = 1960 };
        var newer = new Movie { Title = "Late", OriginalTitle = "Late", ReleaseYear = 1980 };
        var viewer = Guid.NewGuid();
        db.Movies.AddRange(older, newer);
        db.MovieActors.AddRange(new MovieActor { ActorId = actor, MovieId = older.Id },
            new MovieActor { ActorId = actor, MovieId = newer.Id });
        db.WatchlistItems.Add(new WatchlistItem { UserId = viewer, MovieId = older.Id });
        await db.SaveChangesAsync();
        await new ToggleActorLikeCommandHandler(db).Handle(new(actor, viewer), default);
        var details = new GetActorDetailQueryHandler(db);
        var mine = await details.Handle(new(actor, viewer), default);
        Assert.True(mine.IsLikedByCurrentUser);
        Assert.Equal(new[] { newer.Id, older.Id }, mine.Filmography.Select(f => f.Id));
        Assert.True(mine.Filmography[1].IsInWatchlistByCurrentUser);
        var guest = await details.Handle(new(actor, null), default);
        Assert.False(guest.IsLikedByCurrentUser);
        Assert.False(guest.Filmography[1].IsInWatchlistByCurrentUser);
        await new DeleteActorCommandHandler(db).Handle(new(actor), default);
        await Assert.ThrowsAsync<NotFoundException>(() => details.Handle(new(actor, viewer), default));
    }

    [Fact]
    public async Task DirectorDetails_ReflectEditsAndLikes_AndHideDeletedDirector()
    {
        await using var db = TestDbContextFactory.Create();
        var id = await new CreateDirectorCommandHandler(db).Handle(new("Director", null, "", "", ""), default);
        var viewer = Guid.NewGuid();
        var like = new ToggleDirectorLikeCommandHandler(db);
        await like.Handle(new(id, viewer), default);
        await new UpdateDirectorCommandHandler(db).Handle(new(id, "Updated", null, "Bio", "", "TR"), default);
        var details = new GetDirectorDetailQueryHandler(db);
        var saved = await details.Handle(new(id, viewer), default);
        Assert.Equal(("Updated", "Bio", "TR", 1, true),
            (saved.FullName, saved.Biography, saved.Nationality, saved.LikeCount, saved.IsLikedByCurrentUser));
        Assert.False(await like.Handle(new(id, viewer), default));
        Assert.Equal(0, (await details.Handle(new(id, viewer), default)).LikeCount);
        await new DeleteDirectorCommandHandler(db).Handle(new(id), default);
        await Assert.ThrowsAsync<NotFoundException>(() => details.Handle(new(id, null), default));
    }
}
