using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Auth;
using UFMDb.Domain.Entities;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Auth;

public class RefreshTokenCommandHandlerTests
{
    private static async Task<(UFMDb.Persistence.ApplicationDbContext Db, User User, RefreshToken Token)> SeedUserWithTokenAsync(
        DateTime? expiresAtUtc = null, bool isRevoked = false)
    {
        var db = TestDbContextFactory.Create();
        var user = new User { UserName = "yavuz", Email = "yavuz@example.com", PasswordHash = "x", PasswordSalt = "y" };
        db.Users.Add(user);

        var token = new RefreshToken
        {
            UserId = user.Id,
            User = user,
            Token = Guid.NewGuid().ToString("N"),
            ExpiresAtUtc = expiresAtUtc ?? DateTime.UtcNow.AddMonths(1),
            IsRevoked = isRevoked
        };
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync();

        return (db, user, token);
    }

    [Fact]
    public async Task Handle_GecerliToken_YeniTokenUretipEskisiniIptalEder()
    {
        var (db, _, oldToken) = await SeedUserWithTokenAsync();
        var handler = new RefreshTokenCommandHandler(db, new FakeJwtTokenService());

        var result = await handler.Handle(new RefreshTokenCommand(oldToken.Token), default);

        Assert.NotEqual(oldToken.Token, result.RefreshToken);
        Assert.Equal(2, db.RefreshTokens.Count()); // eski (iptal) + yeni

        var reloadedOldToken = db.RefreshTokens.Single(t => t.Token == oldToken.Token);
        Assert.True(reloadedOldToken.IsRevoked); // rotasyon: eski token artık kullanılamaz
    }

    [Fact]
    public async Task Handle_BilinmeyenToken_UnauthorizedExceptionFirlatir()
    {
        var db = TestDbContextFactory.Create();
        var handler = new RefreshTokenCommandHandler(db, new FakeJwtTokenService());

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => handler.Handle(new RefreshTokenCommand("olmayan-token"), default));
    }

    [Fact]
    public async Task Handle_SuresiDolmusToken_UnauthorizedExceptionFirlatir()
    {
        var (db, _, expiredToken) = await SeedUserWithTokenAsync(expiresAtUtc: DateTime.UtcNow.AddMinutes(-1));
        var handler = new RefreshTokenCommandHandler(db, new FakeJwtTokenService());

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => handler.Handle(new RefreshTokenCommand(expiredToken.Token), default));
    }

    [Fact]
    public async Task Handle_IptalEdilmisToken_UnauthorizedExceptionFirlatir()
    {
        // Rotasyon sonrası eski token tekrar kullanılmaya çalışılırsa (çalıntı token senaryosu) reddedilmeli.
        var (db, _, revokedToken) = await SeedUserWithTokenAsync(isRevoked: true);
        var handler = new RefreshTokenCommandHandler(db, new FakeJwtTokenService());

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => handler.Handle(new RefreshTokenCommand(revokedToken.Token), default));
    }
}
