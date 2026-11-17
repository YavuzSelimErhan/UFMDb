using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Reviews;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Reviews;

public class MovieInteractionTests
{
    [Fact]
    public async Task Rating_UpdatesOneVote_PreservesSeedAndHistory_AndRemovesOnlyOwnersWatchlistItem()
    {
        await using var db = TestDbContextFactory.Create();
        var movie = new Movie { Title = "Umut", OriginalTitle = "Umut", SeedRating = 4, SeedVoteCount = 2 };
        var owner = Guid.NewGuid();
        var other = Guid.NewGuid();
        db.Movies.Add(movie);
        db.WatchlistItems.AddRange(new WatchlistItem { MovieId = movie.Id, UserId = owner },
            new WatchlistItem { MovieId = movie.Id, UserId = other });
        await db.SaveChangesAsync();
        var handler = new UpsertRatingCommandHandler(db);
        await handler.Handle(new(movie.Id, owner, 1), default);
        var first = await db.Movies.AsNoTracking().SingleAsync();
        Assert.Equal((3.0, 3), (first.AverageRating, first.RatingCount));
        Assert.Equal(other, (await db.WatchlistItems.AsNoTracking().SingleAsync()).UserId);

        await handler.Handle(new(movie.Id, owner, 5), default);
        var updated = await db.Movies.AsNoTracking().SingleAsync();
        Assert.Equal((4.33, 3), (updated.AverageRating, updated.RatingCount));
        Assert.Equal(5m, (await db.MovieRatings.AsNoTracking().SingleAsync()).Value);

        await handler.Handle(new(movie.Id, owner, 0), default);
        var cleared = await db.Movies.AsNoTracking().SingleAsync();
        Assert.Equal((4.0, 2), (cleared.AverageRating, cleared.RatingCount));
        Assert.Empty(await db.MovieRatings.ToListAsync());
        Assert.Equal(owner, (await db.WatchHistory.AsNoTracking().SingleAsync()).UserId);
    }

    [Fact]
    public async Task UnreleasedFilm_RejectsRatingAndReviewWithoutWritingHistory()
    {
        await using var db = TestDbContextFactory.Create();
        var film = new Movie { Title = "Future", OriginalTitle = "Future", ReleaseDate = DateTime.UtcNow.AddYears(1) };
        db.Movies.Add(film);
        await db.SaveChangesAsync();
        var user = Guid.NewGuid();
        await Assert.ThrowsAsync<ConflictException>(() =>
            new UpsertRatingCommandHandler(db).Handle(new(film.Id, user, 4), default));
        await Assert.ThrowsAsync<ConflictException>(() =>
            new UpsertReviewCommandHandler(db).Handle(new(film.Id, user, "Text", false), default));
        Assert.Empty(await db.Reviews.ToListAsync());
        Assert.Empty(await db.MovieRatings.ToListAsync());
        Assert.Empty(await db.WatchHistory.ToListAsync());
    }

    [Fact]
    public async Task Reactions_SwitchAndUndoWithoutChangingAnotherUsersLike()
    {
        await using var db = TestDbContextFactory.Create();
        var movie = new Movie { Title = "Film", OriginalTitle = "Film" };
        db.Movies.Add(movie);
        await db.SaveChangesAsync();
        var user = Guid.NewGuid();
        var other = Guid.NewGuid();
        var handler = new ReactToMovieCommandHandler(db);
        await handler.Handle(new(movie.Id, other, ReactionType.Like), default);
        Assert.Equal(new MovieReactionResultDto(ReactionType.Like, 2, 0),
            await handler.Handle(new(movie.Id, user, ReactionType.Like), default));
        Assert.Equal(new MovieReactionResultDto(ReactionType.Dislike, 1, 1),
            await handler.Handle(new(movie.Id, user, ReactionType.Dislike), default));
        Assert.Equal(new MovieReactionResultDto(null, 1, 0),
            await handler.Handle(new(movie.Id, user, ReactionType.Dislike), default));
        Assert.Equal(other, (await db.Likes.AsNoTracking().SingleAsync()).UserId);
    }

    [Fact]
    public async Task Review_EditKeepsId_DeleteHidesReviewAndCleansLikeNotification()
    {
        await using var db = TestDbContextFactory.Create();
        var film = new Movie { Title = "Film", OriginalTitle = "Film" };
        db.Movies.Add(film);
        await db.SaveChangesAsync();
        var author = Guid.NewGuid();
        var reader = Guid.NewGuid();
        var write = new UpsertReviewCommandHandler(db);
        var id = await write.Handle(new(film.Id, author, "First", false), default);
        Assert.Equal(id, await write.Handle(new(film.Id, author, "Edited", true), default));
        var saved = await db.Reviews.AsNoTracking().SingleAsync();
        Assert.Equal(("Edited", true), (saved.Content, saved.ContainsSpoiler));
        var like = new ToggleReviewLikeCommandHandler(db);
        await Assert.ThrowsAsync<ConflictException>(() => like.Handle(new(id, author), default));
        Assert.Equal(new ReviewLikeResultDto(true, 1), await like.Handle(new(id, reader), default));
        Assert.Equal(author, (await db.Notifications.AsNoTracking().SingleAsync()).RecipientUserId);
        var delete = new DeleteReviewCommandHandler(db);
        await Assert.ThrowsAsync<NotFoundException>(() => delete.Handle(new(film.Id, reader), default));
        await delete.Handle(new(film.Id, author), default);
        Assert.Empty(await db.Reviews.ToListAsync());
        Assert.True((await db.Reviews.IgnoreQueryFilters().AsNoTracking().SingleAsync()).IsDeleted);
        Assert.Empty(await db.Notifications.ToListAsync());
        Assert.Single(await db.WatchHistory.ToListAsync());
    }
}
