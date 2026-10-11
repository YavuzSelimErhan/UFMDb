using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Feed;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FeedController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUser;

    public FeedController(IMediator mediator, ICurrentUserService currentUser)
    {
        _mediator = mediator;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Tüm aktivite sayfası: takip edilenlerin ve kullanıcının kendi hareketleri, yeniden eskiye.
    /// before: önceki yanıttaki nextBefore (ilk sayfada boş). type: all|reviews|ratings|diary|reactions.
    /// </summary>
    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity(
        [FromQuery] DateTime? before,
        [FromQuery] string? type,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _mediator.Send(
            new GetActivityFeedQuery(_currentUser.UserId!.Value, before, type, pageSize), ct));

    /// <summary>Takip edilen kullanıcıların son 7 günlük film aktivitesi (ana sayfa bölümü).</summary>
    [HttpGet("friends")]
    public async Task<IActionResult> GetFriendsActivity(CancellationToken ct) =>
        Ok(await _mediator.Send(new GetFriendsActivityQuery(_currentUser.UserId!.Value), ct));
}