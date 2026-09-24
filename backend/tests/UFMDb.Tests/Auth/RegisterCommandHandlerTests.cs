using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Features.Auth;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;
using UFMDb.Infrastructure.Services;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Auth;

public class RegisterCommandHandlerTests
{
    private static RegisterCommandHandler CreateHandler(UFMDb.Persistence.ApplicationDbContext db)
        => new(db, new PasswordHasher(), new FakeJwtTokenService());

    [Fact]
    public async Task Handle_YeniKullanici_KullaniciOlusturupTokenDoner()
    {
        using var db = TestDbContextFactory.Create();
        var handler = CreateHandler(db);
        var command = new RegisterCommand("yavuz", "yavuz@example.com", "Sifre123");

        var result = await handler.Handle(command, default);

        Assert.Equal("yavuz", result.UserName);
        Assert.Equal("yavuz@example.com", result.Email);
        Assert.Equal(UserRole.User.ToString(), result.Role);
        Assert.False(string.IsNullOrWhiteSpace(result.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(result.RefreshToken));
        Assert.Single(db.Users);
    }

    [Fact]
    public async Task Handle_SifreDuzMetinOlarakSaklanmaz()
    {
        using var db = TestDbContextFactory.Create();
        var handler = CreateHandler(db);
        var command = new RegisterCommand("yavuz", "yavuz@example.com", "Sifre123");

        await handler.Handle(command, default);

        var savedUser = Assert.Single(db.Users);
        Assert.NotEqual("Sifre123", savedUser.PasswordHash);
        Assert.False(string.IsNullOrWhiteSpace(savedUser.PasswordSalt));
    }

    [Fact]
    public async Task Handle_RefreshTokenVeritabaninaKaydedilir()
    {
        using var db = TestDbContextFactory.Create();
        var handler = CreateHandler(db);
        var command = new RegisterCommand("yavuz", "yavuz@example.com", "Sifre123");

        var result = await handler.Handle(command, default);

        var savedToken = Assert.Single(db.RefreshTokens);
        Assert.Equal(result.RefreshToken, savedToken.Token);
        Assert.Equal(result.UserId, savedToken.UserId);
        Assert.False(savedToken.IsRevoked);
    }

    [Fact]
    public async Task Handle_EmailZatenKayitli_ConflictExceptionFirlatir()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User
        {
            UserName = "baskaKullanici",
            Email = "yavuz@example.com",
            PasswordHash = "x",
            PasswordSalt = "y"
        });
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);
        var command = new RegisterCommand("yeniKullanici", "yavuz@example.com", "Sifre123");

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, default));
    }

    [Fact]
    public async Task Handle_KullaniciAdiZatenKullaniliyor_ConflictExceptionFirlatir()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User
        {
            UserName = "yavuz",
            Email = "baska@example.com",
            PasswordHash = "x",
            PasswordSalt = "y"
        });
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);
        var command = new RegisterCommand("yavuz", "yeni@example.com", "Sifre123");

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, default));
    }
}
