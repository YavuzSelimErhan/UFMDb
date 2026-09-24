using UFMDb.Application.Features.Auth;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Auth;

public class LogoutCommandHandlerTests
{
    [Fact]
    public async Task Handle_GecerliToken_IptalEdilir()
    {
        using var db = TestDbContextFactory.Create();
        var user = new User { UserName = "yavuz", Email = "yavuz@example.com", PasswordHash = "x", PasswordSalt = "y" };
        db.Users.Add(user);
        var token = new RefreshToken
        {
            UserId = user.Id,
            User = user,
            Token = "gecerli-token",
            ExpiresAtUtc = DateTime.UtcNow.AddMonths(1)
        };
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();

        var handler = new LogoutCommandHandler(db);
        await handler.Handle(new LogoutCommand("gecerli-token"), default);

        var reloaded = db.RefreshTokens.Single(t => t.Token == "gecerli-token");
        Assert.True(reloaded.IsRevoked);
    }

    [Fact]
    public async Task Handle_BilinmeyenToken_HataFirlatmaz()
    {
        // logout, sunucuda karşılığı olmayan/çoktan silinmiş bir cookie ile çağrılabilir (idempotent olmalı).
        using var db = TestDbContextFactory.Create();
        var handler = new LogoutCommandHandler(db);

        var exception = await Record.ExceptionAsync(
            () => handler.Handle(new LogoutCommand("olmayan-token"), default));

        Assert.Null(exception);
    }
}
