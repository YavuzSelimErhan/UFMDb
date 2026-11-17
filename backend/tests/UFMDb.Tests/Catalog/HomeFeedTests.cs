using Microsoft.Extensions.Caching.Memory;
using UFMDb.Application.Features.Movies.HomeFeed;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Catalog;

public class HomeFeedTests
{
    [Fact]
    public async Task SharedCache_SeparatesLanguagesAndNeverLeaksPersonalFlags()
    {
        await using var db = TestDbContextFactory.Create();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var movie = new Movie { Title = "Hope", OriginalTitle = "Umut", TitleTr = "Umut", BackdropUrl = "/hope.jpg" };
        var owner = Guid.NewGuid();
        db.Movies.Add(movie);
        db.WatchlistItems.Add(new WatchlistItem { MovieId = movie.Id, UserId = owner });
        db.Likes.Add(new Like { MovieId = movie.Id, UserId = owner, Reaction = ReactionType.Dislike });
        db.MovieRatings.Add(new MovieRating { MovieId = movie.Id, UserId = owner, Value = 3 });
        await db.SaveChangesAsync();

        var handler = new GetHomeFeedQueryHandler(db, cache);
        var mine = await handler.Handle(new(owner, "tr"), default);
        foreach (var rail in new[] { mine.Featured, mine.Popular, mine.TopRated, mine.Trending })
        {
            var item = Assert.Single(rail);
            Assert.Equal("Umut", item.Title);
            Assert.True(item.IsInWatchlistByCurrentUser);
            Assert.True(item.IsWatchedByCurrentUser);
            Assert.Equal(ReactionType.Dislike, item.CurrentUserReaction);
        }
        foreach (var viewer in new Guid?[] { null, Guid.NewGuid() })
        {
            var feed = await handler.Handle(new(viewer, "tr"), default);
            var item = Assert.Single(feed.Featured);
            Assert.False(item.IsInWatchlistByCurrentUser);
            Assert.False(item.IsWatchedByCurrentUser);
            Assert.Null(item.CurrentUserReaction);
        }
        var english = await handler.Handle(new(null, "en"), default);
        Assert.Equal("Hope", Assert.Single(english.Featured).Title);
    }
}
