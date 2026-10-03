using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Auth;

public record AuthResultDto(Guid UserId, string UserName, string Email, string Role, string AccessToken, string RefreshToken);

// ---------- Register ----------
public record RegisterCommand(string UserName, string Email, string Password) : IRequest<AuthResultDto>;

public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.UserName).NotEmpty().MinimumLength(3).MaximumLength(50);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Şifre en az bir büyük harf içermeli.")
            .Matches("[0-9]").WithMessage("Şifre en az bir rakam içermeli.");
    }
}

public class RegisterCommandHandler : IRequestHandler<RegisterCommand, AuthResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;

    public RegisterCommandHandler(IApplicationDbContext context, IPasswordHasher passwordHasher, IJwtTokenService jwtTokenService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
    }

    public async Task<AuthResultDto> Handle(RegisterCommand request, CancellationToken ct)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email, ct))
            throw new ConflictException("Bu e-posta adresi zaten kayıtlı.");

        if (await _context.Users.AnyAsync(u => u.UserName == request.UserName, ct))
            throw new ConflictException("Bu kullanıcı adı zaten kullanılıyor.");

        var (hash, salt) = _passwordHasher.HashPassword(request.Password);

        var user = new User
        {
            UserName = request.UserName,
            Email = request.Email,
            PasswordHash = hash,
            PasswordSalt = salt,
            Role = UserRole.User
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(ct);

        return await IssueTokensAsync(user, ct);
    }

    private async Task<AuthResultDto> IssueTokensAsync(User user, CancellationToken ct)
    {
        var access = _jwtTokenService.GenerateAccessToken(user);
        var refresh = _jwtTokenService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = refresh,
            ExpiresAtUtc = DateTime.UtcNow.AddMonths(1)
        });
        await _context.SaveChangesAsync(ct);

        return new AuthResultDto(user.Id, user.UserName, user.Email, user.Role.ToString(), access, refresh);
    }
}

// ---------- Login ----------
public record LoginCommand(string Email, string Password) : IRequest<AuthResultDto>;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;

    public LoginCommandHandler(IApplicationDbContext context, IPasswordHasher passwordHasher, IJwtTokenService jwtTokenService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
    }

    public async Task<AuthResultDto> Handle(LoginCommand request, CancellationToken ct)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email && u.IsActive, ct)
            ?? throw new UnauthorizedException("E-posta veya şifre hatalı.");

        if (!_passwordHasher.VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt))
            throw new UnauthorizedException("E-posta veya şifre hatalı.");

        var access = _jwtTokenService.GenerateAccessToken(user);
        var refresh = _jwtTokenService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = refresh,
            ExpiresAtUtc = DateTime.UtcNow.AddMonths(1)
        });
        await _context.SaveChangesAsync(ct);

        return new AuthResultDto(user.Id, user.UserName, user.Email, user.Role.ToString(), access, refresh);
    }
}

// ---------- Refresh ----------
public record RefreshTokenCommand(string RefreshToken) : IRequest<AuthResultDto>;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, AuthResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtTokenService _jwtTokenService;

    public RefreshTokenCommandHandler(IApplicationDbContext context, IJwtTokenService jwtTokenService)
    {
        _context = context;
        _jwtTokenService = jwtTokenService;
    }

    public async Task<AuthResultDto> Handle(RefreshTokenCommand request, CancellationToken ct)
    {
        var existing = await _context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken, ct)
            ?? throw new UnauthorizedException("Geçersiz oturum, lütfen tekrar giriş yapın.");

        if (existing.IsRevoked || existing.ExpiresAtUtc < DateTime.UtcNow)
            throw new UnauthorizedException("Oturum süresi doldu, lütfen tekrar giriş yapın.");

        // Rotasyon: eski refresh token'ı iptal edip yenisini üret (güvenlik için)
        existing.IsRevoked = true;

        var user = existing.User;
        var access = _jwtTokenService.GenerateAccessToken(user);
        var refresh = _jwtTokenService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = refresh,
            ExpiresAtUtc = DateTime.UtcNow.AddMonths(1)
        });
        await _context.SaveChangesAsync(ct);

        return new AuthResultDto(user.Id, user.UserName, user.Email, user.Role.ToString(), access, refresh);
    }
}

// ---------- Forgot Password ----------
public record ForgotPasswordCommand(string Email) : IRequest;

public class ForgotPasswordCommandValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}

public class ForgotPasswordCommandHandler : IRequestHandler<ForgotPasswordCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IEmailSender _emailSender;

    public ForgotPasswordCommandHandler(IApplicationDbContext context, IEmailSender emailSender)
    {
        _context = context;
        _emailSender = emailSender;
    }

    public async Task Handle(ForgotPasswordCommand request, CancellationToken ct)
    {
        // Güvenlik: bu e-postanın sistemde kayıtlı olup olmadığı dışarıya hiçbir zaman belli
        // edilmez (e-posta enumeration saldırısını engeller) — bu yüzden kullanıcı bulunamasa
        // bile metot sessizce, hatasız döner; controller her koşulda aynı cevabı verir.
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.IsActive, ct);
        if (user is null) return;

        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

        _context.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAtUtc = DateTime.UtcNow.AddHours(1),
        });
        await _context.SaveChangesAsync(ct);

        await _emailSender.SendPasswordResetEmailAsync(user.Email, user.UserName, rawToken, ct);
    }
}

// ---------- Reset Password ----------
public record ResetPasswordCommand(string Token, string NewPassword) : IRequest;

public class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordCommandValidator()
    {
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Şifre en az bir büyük harf içermeli.")
            .Matches("[0-9]").WithMessage("Şifre en az bir rakam içermeli.");
    }
}

public class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public ResetPasswordCommandHandler(IApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public async Task Handle(ResetPasswordCommand request, CancellationToken ct)
    {
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Token)));

        var resetToken = await _context.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct)
            ?? throw new UnauthorizedException("Bu bağlantı geçersiz veya süresi dolmuş.");

        if (resetToken.IsUsed || resetToken.ExpiresAtUtc < DateTime.UtcNow)
            throw new UnauthorizedException("Bu bağlantı geçersiz veya süresi dolmuş.");

        var (hash, salt) = _passwordHasher.HashPassword(request.NewPassword);
        resetToken.User.PasswordHash = hash;
        resetToken.User.PasswordSalt = salt;
        resetToken.IsUsed = true;

        // Güvenlik: şifre değiştiğinde o kullanıcının başka her yerdeki oturumları
        // (refresh token'ları) iptal edilir — biri şifreyi sıfırladıysa eski cihazlardaki
        // oturumların geçerliliğini sürdürmesi istenmez.
        var activeRefreshTokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == resetToken.UserId && !rt.IsRevoked)
            .ToListAsync(ct);
        foreach (var rt in activeRefreshTokens)
            rt.IsRevoked = true;

        await _context.SaveChangesAsync(ct);
    }
}

// ---------- Logout ----------
public record LogoutCommand(string RefreshToken) : IRequest;

public class LogoutCommandHandler : IRequestHandler<LogoutCommand>
{
    private readonly IApplicationDbContext _context;

    public LogoutCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(LogoutCommand request, CancellationToken ct)
    {
        var token = await _context.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken, ct);
        if (token is not null)
        {
            token.IsRevoked = true;
            await _context.SaveChangesAsync(ct);
        }
    }
}