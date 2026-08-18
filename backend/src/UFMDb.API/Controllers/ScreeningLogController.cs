using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Users;
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

    [HttpGet]
    public async Task<ActionResult<List<ScreeningLogDayDto>>> Get()
        => Ok(await _mediator.Send(new GetScreeningLogQuery(RequireUserId())));

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