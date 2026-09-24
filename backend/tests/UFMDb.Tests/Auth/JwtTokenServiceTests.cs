using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Configuration;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;
using UFMDb.Infrastructure.Services;
using Xunit;

namespace UFMDb.Tests.Auth;

public class JwtTokenServiceTests
{
    private static JwtTokenService CreateService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:Secret"] = "test-only-secret-key-please-do-not-use-in-production-32bytes+",
                ["JwtSettings:Issuer"] = "ufmdb-tests",
                ["JwtSettings:Audience"] = "ufmdb-tests",
                ["JwtSettings:AccessTokenExpirationMinutes"] = "60"
            })
            .Build();

        return new JwtTokenService(config);
    }

    private static User CreateUser() => new()
    {
        Id = Guid.NewGuid(),
        UserName = "yavuz",
        Email = "yavuz@example.com",
        PasswordHash = "x",
        PasswordSalt = "y",
        Role = UserRole.Admin
    };

    [Fact]
    public void GenerateAccessToken_BeklenenClaimleriIcerir()
    {
        var service = CreateService();
        var user = CreateUser();

        var token = service.GenerateAccessToken(user);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal(user.Id.ToString(), jwt.Claims.Single(c => c.Type == JwtRegisteredClaimNames.Sub).Value);
        Assert.Equal(user.Email, jwt.Claims.Single(c => c.Type == JwtRegisteredClaimNames.Email).Value);
        Assert.Equal(user.Role.ToString(), jwt.Claims.Single(c => c.Type == System.Security.Claims.ClaimTypes.Role).Value);
        Assert.Equal("ufmdb-tests", jwt.Issuer);
    }

    [Fact]
    public void GenerateAccessToken_HerCagridaFarkliJtiUretir()
    {
        // Aynı kullanıcı için art arda üretilen tokenlar birbirinden ayırt edilebilmeli
        // (örn. tekil token'ı iptal edebilmek için).
        var service = CreateService();
        var user = CreateUser();

        var token1 = new JwtSecurityTokenHandler().ReadJwtToken(service.GenerateAccessToken(user));
        var token2 = new JwtSecurityTokenHandler().ReadJwtToken(service.GenerateAccessToken(user));

        var jti1 = token1.Claims.Single(c => c.Type == JwtRegisteredClaimNames.Jti).Value;
        var jti2 = token2.Claims.Single(c => c.Type == JwtRegisteredClaimNames.Jti).Value;

        Assert.NotEqual(jti1, jti2);
    }

    [Fact]
    public void GenerateRefreshToken_HerCagridaFarkliDegerUretir()
    {
        var service = CreateService();

        var token1 = service.GenerateRefreshToken();
        var token2 = service.GenerateRefreshToken();

        Assert.NotEqual(token1, token2);
    }
}
