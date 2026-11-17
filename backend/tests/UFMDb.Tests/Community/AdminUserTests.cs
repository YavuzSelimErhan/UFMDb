using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Users;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Community;

public class AdminUserTests
{
    [Fact]
    public async Task Admin_CanManageAnotherAccount_AndCannotDemoteOrDeactivateSelf()
    {
        await using var db = TestDbContextFactory.Create();
        var admin = new User { UserName = "admin", Email = "a@example.test", PasswordHash = "h", PasswordSalt = "s", Role = UserRole.Admin };
        var member = new User { UserName = "user", Email = "u@example.test", PasswordHash = "h", PasswordSalt = "s" };
        db.Users.AddRange(admin, member);
        await db.SaveChangesAsync();
        var role = new UpdateUserRoleCommandHandler(db);
        var active = new ToggleUserActiveCommandHandler(db);
        await Assert.ThrowsAsync<ConflictException>(() => role.Handle(new(admin.Id, admin.Id, UserRole.User), default));
        await Assert.ThrowsAsync<ConflictException>(() => active.Handle(new(admin.Id, admin.Id), default));
        await role.Handle(new(member.Id, admin.Id, UserRole.Admin), default);
        Assert.False(await active.Handle(new(member.Id, admin.Id), default));
        var saved = await db.Users.AsNoTracking().ToDictionaryAsync(u => u.Id);
        Assert.Equal((UserRole.Admin, true), (saved[admin.Id].Role, saved[admin.Id].IsActive));
        Assert.Equal((UserRole.Admin, false), (saved[member.Id].Role, saved[member.Id].IsActive));
    }
}
