using UFMDb.Infrastructure.Services;
using Xunit;

namespace UFMDb.Tests.Auth;

public class PasswordHasherTests
{
    private readonly PasswordHasher _hasher = new();

    [Fact]
    public void VerifyPassword_DogruSifre_TrueDoner()
    {
        var (hash, salt) = _hasher.HashPassword("Sifre123");

        Assert.True(_hasher.VerifyPassword("Sifre123", hash, salt));
    }

    [Fact]
    public void VerifyPassword_YanlisSifre_FalseDoner()
    {
        var (hash, salt) = _hasher.HashPassword("Sifre123");

        Assert.False(_hasher.VerifyPassword("YanlisSifre", hash, salt));
    }

    [Fact]
    public void HashPassword_AyniSifreIcinFarkliHashVeSaltUretir()
    {
        // Her çağrıda rastgele salt üretildiği için aynı şifre bile her seferinde
        // farklı bir hash vermeli (rainbow table saldırılarına karşı).
        var (hash1, salt1) = _hasher.HashPassword("Sifre123");
        var (hash2, salt2) = _hasher.HashPassword("Sifre123");

        Assert.NotEqual(hash1, hash2);
        Assert.NotEqual(salt1, salt2);
    }

    [Fact]
    public void HashPassword_DuzMetinSifreyiIcermez()
    {
        var (hash, _) = _hasher.HashPassword("Sifre123");

        Assert.DoesNotContain("Sifre123", hash);
    }
}
