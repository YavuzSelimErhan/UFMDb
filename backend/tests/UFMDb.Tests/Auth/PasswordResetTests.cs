using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Auth;
using UFMDb.Infrastructure.Services;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Auth;

public class PasswordResetTests
{
    private sealed class Mailbox : IEmailSender
    {
        public List<(string Address, string Token)> Messages { get; } = new();

        public Task SendPasswordResetEmailAsync(string toEmail, string userName, string rawToken, CancellationToken ct)
        {
            Messages.Add((toEmail, rawToken));
            return Task.CompletedTask;
        }
    }

    [Fact]
    public async Task Reset_ChangesPasswordOnce_AndRevokesOnlyThatUsersSessions()
    {
        await using var db = TestDbContextFactory.Create();
        var hasher = new PasswordHasher();
        var register = new RegisterCommandHandler(db, hasher, new FakeJwtTokenService());
        var owner = await register.Handle(new("owner", "owner@example.test", "Initial123"), default);
        var other = await register.Handle(new("other", "other@example.test", "Initial123"), default);
        var mailbox = new Mailbox();
        var forgot = new ForgotPasswordCommandHandler(db, mailbox);
        await forgot.Handle(new("absent@example.test"), default);
        Assert.Empty(mailbox.Messages);
        await forgot.Handle(new(owner.Email), default);
        var message = Assert.Single(mailbox.Messages);
        Assert.Equal(owner.Email, message.Address);
        Assert.NotEqual(message.Token, (await db.PasswordResetTokens.AsNoTracking().SingleAsync()).TokenHash);

        var reset = new ResetPasswordCommandHandler(db, hasher);
        await reset.Handle(new(message.Token, "Changed123"), default);
        var saved = await db.Users.AsNoTracking().SingleAsync(u => u.Id == owner.UserId);
        Assert.True(hasher.VerifyPassword("Changed123", saved.PasswordHash, saved.PasswordSalt));
        Assert.False(hasher.VerifyPassword("Initial123", saved.PasswordHash, saved.PasswordSalt));
        Assert.True((await db.RefreshTokens.AsNoTracking().SingleAsync(t => t.UserId == owner.UserId)).IsRevoked);
        Assert.False((await db.RefreshTokens.AsNoTracking().SingleAsync(t => t.UserId == other.UserId)).IsRevoked);
        await Assert.ThrowsAsync<UnauthorizedException>(() => reset.Handle(new(message.Token, "Again1234"), default));
    }
}
