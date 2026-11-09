using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Compatibility;
using UFMDb.Application.Features.Follows;
using UFMDb.Application.Features.Users;
using UFMDb.Domain.Enums;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FollowsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUser;

    public FollowsController(IMediator mediator, ICurrentUserService currentUser)
    {
        _mediator = mediator;
        _currentUser = currentUser;
    }

    private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanıcı kimliği doğrulanamadı.");

    [HttpPost("users/{targetUserId:guid}/toggle")]
    [Authorize]
    public async Task<IActionResult> Toggle(Guid targetUserId, CancellationToken ct)
    {
        var result = await _mediator.Send(
            new ToggleFollowCommand(RequireUserId(), targetUserId), ct);
        return Ok(result);
    }

    [HttpGet("~/api/users/by-username/{userName}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetProfile(string userName, CancellationToken ct) =>
        Ok(await _mediator.Send(new GetUserProfileQuery(userName, _currentUser.UserId), ct));

    [HttpGet("users/{userId:guid}/followers")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFollowers(Guid userId, CancellationToken ct) =>
        Ok(await _mediator.Send(new GetFollowersQuery(userId, _currentUser.UserId), ct));

    [HttpGet("users/{userId:guid}/following")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFollowing(Guid userId, CancellationToken ct) =>
        Ok(await _mediator.Send(new GetFollowingQuery(userId, _currentUser.UserId), ct));

    [HttpGet("users/search")]
    [AllowAnonymous]
    public async Task<IActionResult> SearchUsers(
    [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
    Ok(await _mediator.Send(new SearchFollowableUsersQuery(search, page, pageSize, _currentUser.UserId), ct));

    [HttpGet("~/api/users/by-username/{userName}/full-profile")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFullProfile(string userName, CancellationToken ct) =>
    Ok(await _mediator.Send(new GetPublicFullProfileQuery(userName, _currentUser.UserId, Request.GetLang()), ct));

    /// <summary>
    /// Bir kullanıcının Seans Defteri (gün bazlı imleçli sayfalama). Görünürlük ayarına göre
    /// herkese açık / yalnızca takipçilere / gizli; erişim yoksa 403, kullanıcı yoksa 404 döner.
    /// </summary>
    [HttpGet("~/api/users/by-username/{userName}/screening-log")]
    [AllowAnonymous]
    public async Task<IActionResult> GetUserScreeningLog(
        string userName,
        [FromQuery] string? cursor,
        [FromQuery] int pageSize = 20,
        [FromQuery] ReactionType? reaction = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default) =>
        Ok(await _mediator.Send(new GetUserScreeningLogQuery(
            userName, _currentUser.UserId, cursor, pageSize, reaction, search, Request.GetLang()), ct));

    /// <summary>Başka bir kullanıcının defter özeti (aynı görünürlük kuralı).</summary>
    [HttpGet("~/api/users/by-username/{userName}/screening-log/summary")]
    [AllowAnonymous]
    public async Task<IActionResult> GetUserScreeningLogSummary(string userName, CancellationToken ct) =>
        Ok(await _mediator.Send(new GetUserScreeningLogSummaryQuery(userName, _currentUser.UserId), ct));

    [HttpGet("~/api/users/{userId:guid}/watched-films")]
    [AllowAnonymous]
    public async Task<IActionResult> GetUserWatchedFilms(
        Guid userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? sortBy = null, [FromQuery] bool? hasRating = null, CancellationToken ct = default) =>
        Ok(await _mediator.Send(new GetUserWatchedMoviesQuery(userId, page, pageSize, sortBy, hasRating, Request.GetLang()), ct));

    // all / rated / unrated sayıları (başka bir kullanıcının profili için)
    [HttpGet("~/api/users/{userId:guid}/watched-films/counts")]
    [AllowAnonymous]
    public async Task<IActionResult> GetUserWatchedFilmsCounts(Guid userId, CancellationToken ct) =>
        Ok(await _mediator.Send(new GetWatchedFilmsCountsQuery(userId), ct));

    /// <summary>Giriş yapan kullanıcı ile hedef kullanıcının zevk uyumu (ortak puanlanan filmlere göre).</summary>
    [HttpGet("~/api/users/{targetUserId:guid}/compatibility")]
    [Authorize]
    public async Task<IActionResult> GetCompatibility(Guid targetUserId, CancellationToken ct) =>
    Ok(await _mediator.Send(new GetCompatibilityQuery(RequireUserId(), targetUserId), ct));
}