using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;

namespace UFMDb.Tests.TestHelpers;

/// <summary>
/// RegisterCommandHandler/LoginCommandHandler/RefreshTokenCommandHandler testlerinde kullanılır.
/// Gerçek JWT üretimi UFMDb.Tests/Auth/JwtTokenServiceTests.cs içinde ayrıca test edilir;
/// burada amaç handler'ın iş kuralı davranışını (kullanıcı/refresh token yönetimi) izole test etmek.
/// </summary>
public class FakeJwtTokenService : IJwtTokenService
{
    public string GenerateAccessToken(User user) => $"fake-access-token:{user.Id}";

    public string GenerateRefreshToken() => Guid.NewGuid().ToString("N");
}
