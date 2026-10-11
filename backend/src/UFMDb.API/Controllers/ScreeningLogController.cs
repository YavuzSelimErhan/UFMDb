using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Users;
using UFMDb.Domain.Enums;
namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/screening-log")]
[Authorize]
public class ScreeningLogController : ControllerBase
{
    private readonly ISender _mediator;
    private readonly ICurrentUserService _currentUser;
    public ScreeningLogController(ISender mediator, ICurrentUserService currentUser)
    {
        _mediator = mediator;
        _currentUser = currentUser;
    }
    private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanıcı kimliği doğrulanamadı.");

    /// <summary>Gün bazlı imleçli sayfalama. cursor: önceki yanıttaki nextCursor (yyyy-MM-dd).</summary>
    [HttpGet]
    public async Task<ActionResult<ScreeningLogPageDto>> Get(
        [FromQuery] string? cursor,
        [FromQuery] int pageSize = 20,
        [FromQuery] ReactionType? reaction = null,
        [FromQuery] string? search = null)
        => Ok(await _mediator.Send(new GetScreeningLogQuery(RequireUserId(), cursor, pageSize, reaction, search)));

    [HttpGet("summary")]
    public async Task<ActionResult<ScreeningLogSummaryDto>> GetSummary()
        => Ok(await _mediator.Send(new GetScreeningLogSummaryQuery(RequireUserId())));

    [HttpPost]
    public async Task<ActionResult<Guid>> Log([FromBody] LogScreeningRequest request)
        => Ok(await _mediator.Send(new LogScreeningCommand(RequireUserId(), request.MovieId, request.WatchedAtUtc, request.Rating)));

    [HttpPut("{entryId:guid}")]
    public async Task<IActionResult> Update(Guid entryId, [FromBody] UpdateScreeningLogRequest request)
    {
        await _mediator.Send(new UpdateScreeningLogEntryCommand(RequireUserId(), entryId, request.WatchedAtUtc, request.Rating));
        return NoContent();
    }

    [HttpDelete("{entryId:guid}")]
    public async Task<IActionResult> Delete(Guid entryId)
    {
        await _mediator.Send(new DeleteScreeningLogEntryCommand(RequireUserId(), entryId));
        return NoContent();
    }
}
public record LogScreeningRequest(Guid MovieId, DateTime WatchedAtUtc, decimal? Rating);
public record UpdateScreeningLogRequest(DateTime WatchedAtUtc, decimal? Rating);