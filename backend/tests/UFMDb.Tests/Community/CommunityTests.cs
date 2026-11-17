using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Follows;
using UFMDb.Application.Features.Lists;
using UFMDb.Application.Features.Notifications;
using UFMDb.Application.Features.Users;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Community;

public class CommunityTests
{
    [Theory]
    [InlineData(DiaryVisibility.Public, true)]
    [InlineData(DiaryVisibility.Followers, false)]
    [InlineData(DiaryVisibility.Private, false)]
    public async Task Diary_AnonymousAndOwnerAccess(DiaryVisibility visibility, bool anonymousAllowed)
    {
        await using var db = TestDbContextFactory.Create();
        var owner = Guid.NewGuid();
        Assert.Equal(anonymousAllowed, await DiaryAccess.CanViewAsync(db, owner, visibility, null, default));
        Assert.True(await DiaryAccess.CanViewAsync(db, owner, visibility, owner, default));
    }

    [Fact]
    public async Task Follow_GrantsOneWayDiaryAccess_AndUnfollowRevokesIt()
    {
        await using var db = TestDbContextFactory.Create();
        var owner = new User { UserName = "owner", Email = "o@example.test", PasswordHash = "hash", PasswordSalt = "salt" };
        db.Users.Add(owner);
        await db.SaveChangesAsync();
        var viewer = Guid.NewGuid();
        var handler = new ToggleFollowCommandHandler(db);
        var command = new ToggleFollowCommand(viewer, owner.Id);
        Assert.True(await handler.Handle(command, default));
        Assert.True(await DiaryAccess.CanViewAsync(db, owner.Id, DiaryVisibility.Followers, viewer, default));
        Assert.False(await DiaryAccess.CanViewAsync(db, viewer, DiaryVisibility.Followers, owner.Id, default));
        Assert.False(await DiaryAccess.CanViewAsync(db, owner.Id, DiaryVisibility.Private, viewer, default));
        var notice = await db.Notifications.AsNoTracking().SingleAsync();
        Assert.Equal((owner.Id, (Guid?)viewer, NotificationType.Follow),
            (notice.RecipientUserId, notice.ActorUserId, notice.Type));
        Assert.False(await handler.Handle(command, default));
        Assert.False(await DiaryAccess.CanViewAsync(db, owner.Id, DiaryVisibility.Followers, viewer, default));
        Assert.Empty(await db.Notifications.ToListAsync());
    }

    [Fact]
    public async Task Notifications_MarkOneAndMarkAllAreScopedToRecipient()
    {
        await using var db = TestDbContextFactory.Create();
        var owner = Guid.NewGuid();
        var other = new Notification { RecipientUserId = Guid.NewGuid() };
        var mine = new Notification { RecipientUserId = owner };
        db.Notifications.AddRange(other, mine, new Notification { RecipientUserId = owner });
        await db.SaveChangesAsync();
        var read = new MarkNotificationReadCommandHandler(db);
        var count = new GetUnreadNotificationCountQueryHandler(db);
        await read.Handle(new(owner, other.Id), default);
        await read.Handle(new(owner, mine.Id), default);
        await read.Handle(new(owner, mine.Id), default);
        Assert.Equal(1, await count.Handle(new(owner), default));
        await new MarkAllNotificationsReadCommandHandler(db).Handle(new(owner), default);
        Assert.Equal(0, await count.Handle(new(owner), default));
        Assert.Equal(1, await count.Handle(new(other.RecipientUserId), default));
    }

    [Fact]
    public async Task RankedList_ChecksOwnership_DeduplicatesAndCompactsOrderOnRemoval()
    {
        await using var db = TestDbContextFactory.Create();
        var owner = Guid.NewGuid();
        var list = new CuratedList { Title = "List", TitleTr = "Liste", Slug = "list", CreatedByUserId = owner, IsRanked = true };
        var first = new Movie { Title = "A", OriginalTitle = "A" };
        var second = new Movie { Title = "B", OriginalTitle = "B" };
        db.AddRange(list, first, second);
        await db.SaveChangesAsync();
        var add = new AddMovieToListCommandHandler(db);
        var command = new AddMovieToListCommand(list.Id, first.Id, null, null, owner, false);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            add.Handle(command with { RequestingUserId = Guid.NewGuid() }, default));
        await add.Handle(command, default);
        await add.Handle(command, default);
        await add.Handle(command with { MovieId = second.Id }, default);
        Assert.Equal(2, (await db.CuratedLists.AsNoTracking().SingleAsync()).ItemCount);
        var remove = new RemoveMovieFromListCommandHandler(db);
        await remove.Handle(new(list.Id, first.Id, owner, false), default);
        await remove.Handle(new(list.Id, first.Id, owner, false), default);
        var saved = await db.CuratedLists.AsNoTracking().Include(l => l.Items).SingleAsync();
        Assert.Equal(1, saved.ItemCount);
        var remaining = Assert.Single(saved.Items);
        Assert.Equal((second.Id, 0), (remaining.MovieId, remaining.Order));
    }
}
