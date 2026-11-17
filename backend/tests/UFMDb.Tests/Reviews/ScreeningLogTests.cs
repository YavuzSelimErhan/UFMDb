using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Users;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Reviews;

public class ScreeningLogTests
{
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
