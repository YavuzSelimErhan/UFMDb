using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Follows;

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

    [HttpPost("users/{targetUserId:guid}/toggle")]
    [Authorize]
    public async Task<IActionResult> Toggle(Guid targetUserId, CancellationToken ct)
    {
        var result = await _mediator.Send(
            new ToggleFollowCommand(_currentUser.UserId!.Value, targetUserId), ct);
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
}