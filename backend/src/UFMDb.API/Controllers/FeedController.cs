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

    /// <summary>Takip edilen kullanıcıların son 7 günlük film aktivitesi (ana sayfa bölümü).</summary>
    [HttpGet("friends")]
    public async Task<IActionResult> GetFriendsActivity(CancellationToken ct) =>
        Ok(await _mediator.Send(new GetFriendsActivityQuery(_currentUser.UserId!.Value), ct));
}