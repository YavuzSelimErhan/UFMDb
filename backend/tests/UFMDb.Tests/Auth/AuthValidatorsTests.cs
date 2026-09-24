using FluentValidation;
using UFMDb.Application.Features.Auth;
using Xunit;

namespace UFMDb.Tests.Auth;

public class RegisterCommandValidatorTests
{
    private readonly RegisterCommandValidator _validator = new();

    [Fact]
    public void Valid_GecerliKomut_HataYok()
    {
        var result = _validator.Validate(new RegisterCommand("yavuz", "yavuz@example.com", "Sifre123"));
        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("", "yavuz@example.com", "Sifre123")]  // boş kullanıcı adı
    [InlineData("ab", "yavuz@example.com", "Sifre123")] // 3 karakterden kısa kullanıcı adı
    [InlineData("yavuz", "gecersiz-email", "Sifre123")] // geçersiz e-posta formatı
    [InlineData("yavuz", "yavuz@example.com", "kisa1")] // 8 karakterden kısa şifre
    [InlineData("yavuz", "yavuz@example.com", "sifresiz")] // büyük harf yok
    [InlineData("yavuz", "yavuz@example.com", "SIFREBUYUK")] // rakam yok
    public void Validate_GecersizGirdiler_HataDoner(string userName, string email, string password)
    {
        var result = _validator.Validate(new RegisterCommand(userName, email, password));
        Assert.False(result.IsValid);
    }
}

public class LoginCommandValidatorTests
{
    private readonly LoginCommandValidator _validator = new();

    [Fact]
    public void Validate_GecerliKomut_HataYok()
    {
        var result = _validator.Validate(new LoginCommand("yavuz@example.com", "herhangibir"));
        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("", "sifre")]              // boş e-posta
    [InlineData("gecersiz-email", "sifre")] // geçersiz e-posta formatı
    [InlineData("yavuz@example.com", "")]   // boş şifre
    public void Validate_GecersizGirdiler_HataDoner(string email, string password)
    {
        var result = _validator.Validate(new LoginCommand(email, password));
        Assert.False(result.IsValid);
    }
}
