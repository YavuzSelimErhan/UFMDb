using Microsoft.EntityFrameworkCore;
using UFMDb.Tests.TestHelpers;
using UFMDb.Application.DTOs;
using UFMDb.Application.Features.Feed;
using UFMDb.Application.Features.Movies.GetMovieDetail;
using UFMDb.Application.Features.Movies.GetMovies;
using UFMDb.Application.Features.Users;
using UFMDb.Domain.Entities;
using UFMDb.Persistence;
using Xunit;

namespace UFMDb.Tests.Catalog;

// Each case uses a generated database. The configured account needs CREATEDB.
public class PostgresCatalogTests : IAsyncLifetime
{
    private readonly ApplicationDbContext db = PostgresDatabase.CreateContext();

    public async Task InitializeAsync() => await db.Database.EnsureCreatedAsync();

    public async Task DisposeAsync()
    {
        try { await db.Database.EnsureDeletedAsync(); }
        finally { await db.DisposeAsync(); }
    }

    [PostgresFact]
    public async Task Search_NormalizesAccents_RanksExactFirst_AndPaginatesAfterFiltering()
    {
        var exact = new Movie { Title = "Amélie", OriginalTitle = "Amélie", ReleaseYear = 2001 };
        db.Movies.AddRange(exact,
            new Movie { Title = "Amélie returns", OriginalTitle = "B", ReleaseYear = 2002 },
            new Movie { Title = "Hidden", OriginalTitle = "Amélie", ReleaseYear = 2000, IsDeleted = true },
            new Movie { Title = "Older", OriginalTitle = "Amélie", ReleaseYear = 1990 });
        await db.SaveChangesAsync();
        var filter = new MovieSearchQueryDto("amelie", null, null, null, null, null,
            PageSize: 1, SortBy: "year", SortDirection: "desc", YearFrom: 2000);
        var handler = new GetMoviesQueryHandler(db);
        var first = await handler.Handle(new(filter, null), default);
        Assert.Equal(2, first.TotalCount);
        Assert.Equal(exact.Id, Assert.Single(first.Items).Id);
        var second = await handler.Handle(new(filter with { Page = 2 }, null), default);
        Assert.Equal("Amélie returns", Assert.Single(second.Items).Title);
    }

    [PostgresFact]
    public async Task ClearWatchlist_DeletesOnlyTheRequestedUsersRows_AndIsRepeatable()
    {
        var owner = NewUser("owner");
        var other = NewUser("other");
        var film = new Movie { Title = "Umut", OriginalTitle = "Umut" };
        db.AddRange(owner, other, film);
        db.WatchlistItems.AddRange(
            new WatchlistItem { MovieId = film.Id, UserId = owner.Id },
            new WatchlistItem { MovieId = film.Id, UserId = other.Id });
        await db.SaveChangesAsync();

        var handler = new ClearWatchlistCommandHandler(db);
        Assert.Equal(1, await handler.Handle(new(owner.Id), default));
        Assert.Equal(0, await handler.Handle(new(owner.Id), default));
        Assert.Equal(other.Id, (await db.WatchlistItems.AsNoTracking().SingleAsync()).UserId);
    }

    [PostgresFact]
    public async Task Search_TreatsPercentAndUnderscoreInTitlesAsLiteral()
    {
        db.Movies.AddRange(
            new Movie { Title = "100%_Film", OriginalTitle = "Exact" },
            new Movie { Title = "100XYZFilm", OriginalTitle = "Decoy" });
        await db.SaveChangesAsync();
        var result = await new GetMoviesQueryHandler(db).Handle(
            new(new MovieSearchQueryDto("100%_", null, null, null, null, null), null), default);
        Assert.Equal("100%_Film", Assert.Single(result.Items).Title);
    }

    [PostgresFact]
    public async Task RatingSort_WeightsVoteCount_AndReturnsLocalizedTitlesInRankOrder()
    {
        var popular = new Movie { Title = "Popular", OriginalTitle = "Popular", TitleTr = "Popüler",
            AverageRating = 4.8, RatingCount = 20000 };
        db.Movies.AddRange(popular,
            new Movie { Title = "One vote", OriginalTitle = "One vote", AverageRating = 5, RatingCount = 1 },
            new Movie { Title = "Low", OriginalTitle = "Low", AverageRating = 1, RatingCount = 20000 });
        await db.SaveChangesAsync();
        var filter = new MovieSearchQueryDto(null, null, null, null, null, null,
            Page: 0, PageSize: 200, SortBy: "rating", SortDirection: "desc");
        var result = await new GetMoviesQueryHandler(db).Handle(new(filter, null, "tr"), default);
        Assert.Equal((1, 100), (result.Page, result.PageSize));
        Assert.Equal(new[] { "Popüler", "One vote", "Low" }, result.Items.Select(m => m.Title));
    }

    [PostgresFact]
    public async Task DiaryOwnerLookup_ResolvesLiteralUnderscoreInUserName()
    {
        var exact = NewUser("film_fan");
        db.Users.AddRange(NewUser("filmXfan"), exact);
        await db.SaveChangesAsync();
        Assert.Equal(exact.Id, await DiaryAccess.ResolveOwnerAsync(db, " FILM_FAN ", null, default));
    }

    [PostgresFact]
    public async Task ScreeningPages_KeepWholeDaysAndCountEarlierRewatches()
    {
        var owner = NewUser("viewer");
        var film = new Movie { Title = "Hope", TitleTr = "Umut", OriginalTitle = "Umut" };
        db.AddRange(owner, film);
        var date = new DateTime(2020, 4, 2, 0, 0, 0, DateTimeKind.Utc);
        foreach (var when in new[] { date.AddDays(-1), date, date.AddHours(4) })
            db.WatchHistory.Add(new WatchHistory { UserId = owner.Id, MovieId = film.Id, WatchedAtUtc = when });
        await db.SaveChangesAsync();

        var query = new GetScreeningLogQuery(owner.Id, PageSize: 1, Search: "umut", Lang: "tr");
        var handler = new GetScreeningLogQueryHandler(db);
        var first = await handler.Handle(query, default);
        Assert.Equal("2020-04-02", first.NextCursor);
        var entries = Assert.Single(first.Days).Entries;
        Assert.Equal(new[] { 3, 2 }, entries.Select(e => e.ScreeningNumber));
        Assert.All(entries, e => Assert.Equal("Umut", e.MovieTitle));
        var last = await handler.Handle(query with { Cursor = first.NextCursor }, default);
        Assert.Null(last.NextCursor);
        Assert.Equal(1, Assert.Single(Assert.Single(last.Days).Entries).ScreeningNumber);
    }

    [PostgresFact]
    public async Task FilmDetail_ReadsMyRatingAndSpoilerReview_AndLocalizesTheTitle()
    {
        var author = NewUser("author");
        var film = new Movie { Title = "Hope", TitleTr = "Umut", OriginalTitle = "Umut" };
        db.AddRange(author, film);
        db.MovieRatings.Add(new MovieRating { MovieId = film.Id, UserId = author.Id, Value = 4.5m });
        db.Reviews.Add(new Review { MovieId = film.Id, UserId = author.Id, Content = "Final", ContainsSpoiler = true });
        await db.SaveChangesAsync();

        var handler = new GetMovieDetailQueryHandler(db);
        var mine = await handler.Handle(new(film.Id, author.Id, "tr"), default);
        Assert.Equal("Umut", mine.Title);
        Assert.True(mine.IsWatchedByCurrentUser);
        Assert.Equal(4.5m, mine.MyRating);
        Assert.Equal(new MyReviewDto("Final", true), mine.MyReview);
        var guest = await handler.Handle(new(film.Id, null), default);
        Assert.Equal("Hope", guest.Title);
        Assert.False(guest.IsWatchedByCurrentUser);
        Assert.Null(guest.MyReview);
        Assert.Null(guest.MyRating);
    }

    [PostgresFact]
    public async Task FollowedReview_AppearsInActivityButSpotlightOmitsSpoilerText()
    {
        var viewer = NewUser("viewer");
        var friend = NewUser("friend");
        var stranger = NewUser("stranger");
        var film = new Movie { Title = "Hope", TitleTr = "Umut", OriginalTitle = "Umut" };
        db.AddRange(viewer, friend, stranger, film);
        db.Follows.Add(new Follow { FollowerId = viewer.Id, FollowingId = friend.Id });
        db.Reviews.AddRange(
            new Review { MovieId = film.Id, UserId = friend.Id, ContainsSpoiler = true, Content = "The ending" },
            new Review { MovieId = film.Id, UserId = stranger.Id, Content = "Outside the feed" });
        await db.SaveChangesAsync();

        var activity = await new GetActivityFeedQueryHandler(db).Handle(new(viewer.Id, null, "reviews", 20, "tr"), default);
        var row = Assert.Single(activity.Items);
        Assert.Equal((friend.Id, "Umut", "The ending", true),
            (row.User.Id, row.Movie.Title, row.ReviewContent, row.ContainsSpoiler));
        var friends = await new GetFriendsActivityQueryHandler(db).Handle(new(viewer.Id), default);
        Assert.Equal(1, friends.WeeklyActiveFriendCount);
        Assert.NotNull(friends.Spotlight);
        Assert.Equal(friend.Id, friends.Spotlight.User.Id);
        Assert.True(friends.Spotlight.ContainsSpoiler);
        Assert.Null(friends.Spotlight.ReviewExcerpt);
    }

    [PostgresFact]
    public async Task Activity_PagesWholeCardsAcrossEqualTimestamps_AndRespectsPrivateDiary()
    {
        var viewer = NewUser("viewer");
        var friend = NewUser("friend");
        friend.DiaryVisibility = UFMDb.Domain.Enums.DiaryVisibility.Private;
        var films = Enumerable.Range(1, 3).Select(i => new Movie { Title = $"Film {i}", OriginalTitle = $"Film {i}" }).ToList();
        db.AddRange(viewer, friend);
        db.Movies.AddRange(films);
        db.Follows.Add(new Follow { FollowerId = viewer.Id, FollowingId = friend.Id });
        var at = new DateTime(2020, 4, 2, 20, 0, 0, DateTimeKind.Utc);
        foreach (var film in films)
        {
            db.WatchHistory.Add(new WatchHistory { UserId = viewer.Id, MovieId = film.Id, WatchedAtUtc = at });
            db.Reviews.Add(new Review { UserId = viewer.Id, MovieId = film.Id, Content = "Earlier", UpdatedAtUtc = at.AddHours(-1) });
        }
        db.WatchHistory.Add(new WatchHistory { UserId = friend.Id, MovieId = films[0].Id, WatchedAtUtc = at.AddDays(1) });
        await db.SaveChangesAsync();

        var handler = new GetActivityFeedQueryHandler(db);
        var query = new GetActivityFeedQuery(viewer.Id, null, "all", 1);
        var seen = new HashSet<Guid>();
        for (var i = 0; i < films.Count; i++)
        {
            var result = await handler.Handle(query, default);
            var row = Assert.Single(result.Items);
            Assert.True(seen.Add(row.Movie.Id));
            Assert.Equal(viewer.Id, row.User.Id);
            Assert.True(row.Watched && row.HasReview);
            Assert.Equal(at, row.LastActivityAtUtc);
            Assert.Equal(i + 1 < films.Count, result.HasMore);
            query = query with { Before = result.NextBefore, BeforeUser = row.User.Id, BeforeMovie = row.Movie.Id };
        }
    }

    [PostgresFact]
    public async Task Activity_GroupsAcrossUtcMidnightInViewersTimeZone()
    {
        var viewer = NewUser("viewer");
        var film = new Movie { Title = "Film", OriginalTitle = "Film" };
        db.AddRange(viewer, film);
        var at = new DateTime(2026, 11, 18, 22, 30, 0, DateTimeKind.Utc);
        db.WatchHistory.Add(new WatchHistory { UserId = viewer.Id, MovieId = film.Id, WatchedAtUtc = at });
        db.Reviews.Add(new Review { UserId = viewer.Id, MovieId = film.Id, Content = "Review", UpdatedAtUtc = at.AddHours(2) });
        db.MovieRatings.Add(new MovieRating { MovieId = film.Id, UserId = viewer.Id, Value = 4.5m, UpdatedAtUtc = at });
        db.Likes.Add(new Like { MovieId = film.Id, UserId = viewer.Id, Reaction = UFMDb.Domain.Enums.ReactionType.Like, UpdatedAtUtc = at });
        await db.SaveChangesAsync();
        var handler = new GetActivityFeedQueryHandler(db);
        var query = new GetActivityFeedQuery(viewer.Id, null, "all", 1, TimeZone: "Europe/Istanbul");
        var local = await handler.Handle(query, default);
        var card = Assert.Single(local.Items);
        Assert.True(card.Watched && card.HasReview);
        Assert.Equal(4.5m, card.Rating);
        Assert.Equal("Like", card.Reaction);
        Assert.False(local.HasMore);
        var utc = await handler.Handle(query with { TimeZone = "UTC" }, default);
        Assert.True(utc.HasMore);
        Assert.False(Assert.Single(utc.Items).Watched);
    }

    private static User NewUser(string name) => new()
    {
        UserName = name, Email = $"{name}@example.test", PasswordHash = "hash", PasswordSalt = "salt"
    };
}
