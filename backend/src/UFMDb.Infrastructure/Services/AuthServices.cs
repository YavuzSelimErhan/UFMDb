using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;

namespace UFMDb.Infrastructure.Services;

public class JwtSettings
{
    public string Secret { get; set; } = default!;
    public string Issuer { get; set; } = default!;
    public string Audience { get; set; } = default!;
    public int AccessTokenExpirationMinutes { get; set; } = 60;
}

public class JwtTokenService : IJwtTokenService
{
    private readonly JwtSettings _settings;
    public JwtTokenService(IConfiguration configuration)
    {
        _settings = configuration.GetSection("JwtSettings").Get<JwtSettings>()
            ?? throw new InvalidOperationException("JwtSettings yapılandırması bulunamadı.");
    }

    public string GenerateAccessToken(User user)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Name, user.UserName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_settings.AccessTokenExpirationMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }
}

/// <summary>PBKDF2 tabanlı şifre hashleme (bcrypt/argon2 de tercih edilebilir).</summary>
public class PasswordHasher : IPasswordHasher
{
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const int Iterations = 100_000;

    public (string Hash, string Salt) HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeySize);
        return (Convert.ToBase64String(hash), Convert.ToBase64String(salt));
    }

    public bool VerifyPassword(string password, string hash, string salt)
    {
        var saltBytes = Convert.FromBase64String(salt);
        var expected = Convert.FromBase64String(hash);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, saltBytes, Iterations, HashAlgorithmName.SHA256, KeySize);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}

/// <summary>HttpContext üzerinden JWT claim'lerini okuyup Application katmanına sunar.</summary>
public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    public CurrentUserService(IHttpContextAccessor httpContextAccessor) => _httpContextAccessor = httpContextAccessor;

    public Guid? UserId
    {
        get
        {
            var value = _httpContextAccessor.HttpContext?.User?.FindFirstValue(JwtRegisteredClaimNames.Sub);
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }

    public string? UserName => _httpContextAccessor.HttpContext?.User?.Identity?.Name;

    public bool IsAdmin => _httpContextAccessor.HttpContext?.User?.IsInRole("Admin") ?? false;

    public bool IsAuthenticated => _httpContextAccessor.HttpContext?.User?.Identity?.IsAuthenticated ?? false;
}

public class DateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}

/// <summary>
/// Gmail SMTP üzerinden mail gönderir (App Password ile — normal Gmail şifresiyle çalışmaz).
/// Gerekli config anahtarları: Smtp:User, Smtp:AppPassword, App:FrontendBaseUrl.
/// Smtp:FromName opsiyonel, verilmezse "UFMDb" kullanılır.
/// </summary>
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string userName, string rawToken, CancellationToken ct)
    {
        var smtpUser = _configuration["Smtp:User"]
            ?? throw new InvalidOperationException("Smtp:User yapılandırması bulunamadı.");
        var smtpAppPassword = _configuration["Smtp:AppPassword"]
            ?? throw new InvalidOperationException("Smtp:AppPassword yapılandırması bulunamadı.");
        var fromName = _configuration["Smtp:FromName"] ?? "UFMDb";
        var frontendBaseUrl = (_configuration["App:FrontendBaseUrl"]
            ?? throw new InvalidOperationException("App:FrontendBaseUrl yapılandırması bulunamadı.")).TrimEnd('/');

        var resetLink = $"{frontendBaseUrl}/reset-password?token={rawToken}";

        using var client = new SmtpClient("smtp.gmail.com", 587)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(smtpUser, smtpAppPassword),
        };

        using var message = new MailMessage
        {
            From = new MailAddress(smtpUser, fromName),
            Subject = "UFMDb — Şifre sıfırlama",
            Body = BuildHtmlBody(userName, resetLink),
            IsBodyHtml = true,
        };
        message.To.Add(toEmail);

        try
        {
            await client.SendMailAsync(message, ct);
        }
        catch (Exception ex)
        {
            // Mail gönterimi başarısız olsa bile kullanıcıya bu sızdırılmaz (ForgotPasswordCommandHandler
            // her koşulda aynı cevabı veriyor) — burada sadece loglayıp sessizce yutuyoruz ki SMTP
            // sorunları "şifremi unuttum" akışını 500 ile çökertmesin.
            _logger.LogError(ex, "Şifre sıfırlama maili gönderilemedi: {Email}", toEmail);
        }
    }

    private static string BuildHtmlBody(string userName, string resetLink) => $"""
        <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #14161a;">
          <p style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 24px;">UFMDb</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Merhaba {WebUtility.HtmlEncode(userName)},</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            Hesabın için bir şifre sıfırlama isteği aldık. Aşağıdaki butona tıklayarak yeni bir şifre belirleyebilirsin.
            Bu linkin süresi <strong>1 saat</strong> sonra dolacak.
          </p>
          <p style="margin: 0 0 24px;">
            <a href="{resetLink}" style="display: inline-block; background: #4a90e2; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 22px; border-radius: 8px;">
              Şifremi sıfırla
            </a>
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #565d6b; margin: 0 0 8px;">
            Buton çalışmazsa şu linki tarayıcına yapıştırabilirsin:<br />
            <a href="{resetLink}" style="color: #4a90e2;">{resetLink}</a>
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #565d6b; margin: 24px 0 0;">
            Bu isteği sen yapmadıysan bu maili görmezden gelebilirsin, hesabında herhangi bir değişiklik yapılmayacak.
          </p>
        </div>
        """;
}