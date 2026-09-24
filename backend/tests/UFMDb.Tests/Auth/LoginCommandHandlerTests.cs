using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Auth;
using UFMDb.Domain.Entities;
using UFMDb.Infrastructure.Services;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Auth;

public class LoginCommandHandlerTests
{
    private static readonly IPasswordHasher Hasher = new PasswordHasher();

    private static User CreateUser(string email, string password, bool isActive = true)
    {
        var (hash, salt) = Hasher.HashPassword(password);
        return new User
        {
            UserName = "yavuz",
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
            IsActive = isActive
        };
    }

    private static LoginCommandHandler CreateHandler(UFMDb.Persistence.ApplicationDbContext db)
        => new(db, Hasher, new FakeJwtTokenService());

    [Fact]
    public async Task Handle_DogruBilgiler_TokenDoner()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(CreateUser("yavuz@example.com", "Sifre123"));
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);
        var result = await handler.Handle(new LoginCommand("yavuz@example.com", "Sifre123"), default);

        Assert.False(string.IsNullOrWhiteSpace(result.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(result.RefreshToken));
    }

    [Fact]
    public async Task Handle_YanlisSifre_UnauthorizedExceptionFirlatir()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(CreateUser("yavuz@example.com", "Sifre123"));
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => handler.Handle(new LoginCommand("yavuz@example.com", "YanlisSifre1"), default));
    }

    [Fact]
    public async Task Handle_BilinmeyenEmail_UnauthorizedExceptionFirlatir()
    {
        using var db = TestDbContextFactory.Create();
        var handler = CreateHandler(db);

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => handler.Handle(new LoginCommand("yok@example.com", "Sifre123"), default));
    }

    [Fact]
    public async Task Handle_PasifKullanici_UnauthorizedExceptionFirlatir()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(CreateUser("yavuz@example.com", "Sifre123", isActive: false));
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);

        // Hesabı devre dışı bırakılmış (banlı/silinmiş) kullanıcı login olamamalı.
        await Assert.ThrowsAsync<UnauthorizedException>(
            () => handler.Handle(new LoginCommand("yavuz@example.com", "Sifre123"), default));
    }

    [Fact]
    public async Task Handle_HataliGiris_HataMesajiBilgiSizintisiYapmaz()
    {
        // Güvenlik: "email yok" ile "şifre yanlış" aynı mesajı dönmeli,
        // aksi halde saldırgan hangi e-postaların kayıtlı olduğunu tespit edebilir.
        using var db = TestDbContextFactory.Create();
        db.Users.Add(CreateUser("yavuz@example.com", "Sifre123"));
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);

        var wrongPasswordEx = await Assert.ThrowsAsync<UnauthorizedException>(
            () => handler.Handle(new LoginCommand("yavuz@example.com", "YanlisSifre1"), default));
        var unknownEmailEx = await Assert.ThrowsAsync<UnauthorizedException>(
            () => handler.Handle(new LoginCommand("yok@example.com", "Sifre123"), default));

        Assert.Equal(unknownEmailEx.Message, wrongPasswordEx.Message);
    }

    [Fact]
    public async Task Handle_BasariliGiris_RefreshTokenVeritabaninaKaydedilir()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(CreateUser("yavuz@example.com", "Sifre123"));
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);
        var result = await handler.Handle(new LoginCommand("yavuz@example.com", "Sifre123"), default);

        var savedToken = Assert.Single(db.RefreshTokens);
        Assert.Equal(result.RefreshToken, savedToken.Token);
        Assert.False(savedToken.IsRevoked);
    }
}
