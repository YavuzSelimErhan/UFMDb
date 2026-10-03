using UFMDb.Domain.Entities;

namespace UFMDb.Application.Common.Interfaces;

public interface IJwtTokenService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
}

public interface IPasswordHasher
{
    (string Hash, string Salt) HashPassword(string password);
    bool VerifyPassword(string password, string hash, string salt);
}

/// <summary>HTTP context üzerinden o an istek yapan kullanıcının bilgisini taşır</summary>
public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? UserName { get; }
    bool IsAdmin { get; }
    bool IsAuthenticated { get; }
}

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}

/// <summary>
/// Mail gönderimini soyutlar. Implementasyon (Infrastructure) hem SMTP göndermeyi hem de
/// sıfırlama linkinin tam URL'ini (frontend adresi + ham token) kurmayı üstlenir — Application
/// katmanı böylece IConfiguration'a veya frontend URL'ine bağımlı olmaz.
/// </summary>
public interface IEmailSender
{
    Task SendPasswordResetEmailAsync(string toEmail, string userName, string rawToken, CancellationToken ct);
}