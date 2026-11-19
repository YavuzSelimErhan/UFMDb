using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Users;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Reviews;

public class ScreeningLogTests
{
    [Fact]
    public async Task EditingUnratedScreeningTime_PreservesQuickRating()
    {
        await using var db = TestDbContextFactory.Create();
        var film = new Movie { Title = "Film", OriginalTitle = "Film" };
        var user = Guid.NewGuid();
        db.Movies.Add(film);
        db.MovieRatings.Add(new MovieRating { UserId = user, MovieId = film.Id, Value = 4 });
        await db.SaveChangesAsync();
        var day = DateTime.UtcNow.AddDays(-2);
        var id = await new LogScreeningCommandHandler(db).Handle(new(user, film.Id, day, null), default);
        await new UpdateScreeningLogEntryCommandHandler(db).Handle(new(user, id, day.AddHours(1), null), default);
        Assert.Equal(4m, (await db.MovieRatings.AsNoTracking().SingleAsync()).Value);
    }

    [Fact]
    public async Task BackfilledScreeningAndItsEdits_PreserveNewerRatingAndActivityTimestamp()
    {
        await using var db = TestDbContextFactory.Create();
        var film = new Movie { Title = "Film", OriginalTitle = "Film" };
        var user = Guid.NewGuid();
        db.Movies.Add(film);
        await db.SaveChangesAsync();
        var day = DateTime.UtcNow.AddDays(-10);
        var log = new LogScreeningCommandHandler(db);
        await log.Handle(new(user, film.Id, day, 5), default);
        var initial = await db.MovieRatings.AsNoTracking().SingleAsync();
        var old = await log.Handle(new(user, film.Id, day.AddYears(-1), 3), default);
        var edit = new UpdateScreeningLogEntryCommandHandler(db);
        await edit.Handle(new(user, old, day.AddYears(-1).AddHours(1), 3), default);
        await edit.Handle(new(user, old, day.AddYears(-1), 2), default);
        var rating = await db.MovieRatings.AsNoTracking().SingleAsync();
        Assert.Equal(5m, rating.Value);
        Assert.Equal(initial.UpdatedAtUtc, rating.UpdatedAtUtc);
    }

    [Theory]
    [InlineData(-6, true)]
    [InlineData(6, false)]
    public void ScreeningTimeValidation_AgreesForAddAndEdit(int hours, bool valid)
    {
        var at = DateTime.UtcNow.AddHours(hours);
        var user = Guid.NewGuid();
        var id = Guid.NewGuid();
        Assert.Equal(valid, new LogScreeningCommandValidator().Validate(new LogScreeningCommand(user, id, at, null)).IsValid);
        Assert.Equal(valid, new UpdateScreeningLogEntryCommandValidator().Validate(new UpdateScreeningLogEntryCommand(user, id, at, null)).IsValid);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task RemovingLatestRating_FallsBackToEarlierScreening(bool deleteEntry)
    {
        await using var db = TestDbContextFactory.Create();
        var film = new Movie { Title = "Film", OriginalTitle = "Film" };
        db.Movies.Add(film);
        await db.SaveChangesAsync();
        var author = Guid.NewGuid();
        var firstDay = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var lastDay = firstDay.AddDays(1);
        var log = new LogScreeningCommandHandler(db);
        var first = await log.Handle(new(author, film.Id, firstDay, 3), default);
        var last = await log.Handle(new(author, film.Id, lastDay, 5), default);
        var remove = new DeleteScreeningLogEntryCommandHandler(db);
        await Assert.ThrowsAsync<NotFoundException>(() => remove.Handle(new(Guid.NewGuid(), last), default));
        Assert.Equal(5m, (await db.MovieRatings.AsNoTracking().SingleAsync()).Value);
        if (deleteEntry)
            await remove.Handle(new(author, last), default);
        else
            await new UpdateScreeningLogEntryCommandHandler(db).Handle(new(author, last, lastDay, null), default);

        Assert.Equal(3m, (await db.MovieRatings.AsNoTracking().SingleAsync()).Value);
        Assert.Equal(deleteEntry ? 1 : 2, await db.WatchHistory.CountAsync());
        await remove.Handle(new(author, first), default);
        Assert.Empty(await db.MovieRatings.ToListAsync());
        Assert.Equal(0, (await db.Movies.AsNoTracking().SingleAsync()).RatingCount);
    }
}
