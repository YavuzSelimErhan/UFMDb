using MediatR;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Features.Auth;

namespace UFMDb.API.Controllers;

// Refresh token artık response body'sinde değil, sadece bu DTO ile access token dönülüyor.
public record AuthResponseDto(Guid UserId, string UserName, string Email, string Role, string AccessToken);

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ISender _mediator;
    public AuthController(ISender mediator) => _mediator = mediator;

    private const string RefreshCookieName = "ufmdb_refresh";

    private void SetRefreshCookie(string token)
    {
        Response.Cookies.Append(RefreshCookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,              // HTTPS zorunlu (Azure'da zaten HTTPS)
            SameSite = SameSiteMode.None, // farklı domain (GitHub Pages ↔ Azure) için şart
            Expires = DateTimeOffset.UtcNow.AddMonths(1),
            Path = "/"
        });
    }

    private void ClearRefreshCookie()
    {
        Response.Cookies.Delete(RefreshCookieName, new CookieOptions { Path = "/" });
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterCommand command)
    {
        var result = await _mediator.Send(command);
        SetRefreshCookie(result.RefreshToken);
        return Ok(new AuthResponseDto(result.UserId, result.UserName, result.Email, result.Role, result.AccessToken));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginCommand command)
    {
        var result = await _mediator.Send(command);
        SetRefreshCookie(result.RefreshToken);
        return Ok(new AuthResponseDto(result.UserId, result.UserName, result.Email, result.Role, result.AccessToken));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponseDto>> Refresh()
    {
        var cookieToken = Request.Cookies[RefreshCookieName];
        if (string.IsNullOrEmpty(cookieToken))
            return Unauthorized();

        var result = await _mediator.Send(new RefreshTokenCommand(cookieToken));
        SetRefreshCookie(result.RefreshToken); // rotasyon: yeni refresh token cookie'ye yazılır
        return Ok(new AuthResponseDto(result.UserId, result.UserName, result.Email, result.Role, result.AccessToken));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var cookieToken = Request.Cookies[RefreshCookieName];
        if (!string.IsNullOrEmpty(cookieToken))
            await _mediator.Send(new LogoutCommand(cookieToken));

        ClearRefreshCookie();
        return NoContent();
    }
}