using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.People;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/people")]
public class PeopleController(ISender mediator, ICurrentUserService currentUser) : ControllerBase
{
    private Guid RequireUserId() =>
        currentUser.UserId ?? throw new UnauthorizedException("Kullanýcý kimliði doðrulanamadý.");

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search, [FromQuery] string? role,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await mediator.Send(new GetPeople(search, role, page, pageSize), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        Ok(await mediator.Send(new GetPerson(id, Request.GetLang(), currentUser.UserId), ct));

    [Authorize]
    [HttpPost("{id:guid}/like")]
    public async Task<ActionResult<bool>> ToggleLike(Guid id, CancellationToken ct) =>
        Ok(await mediator.Send(new TogglePersonLike(id, RequireUserId()), ct));

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Create(CreatePerson command, CancellationToken ct) =>
        Ok(await mediator.Send(command, ct));

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdatePerson command, CancellationToken ct)
    {
        if (id != command.Id) return BadRequest("Id uyuþmuyor.");
        await mediator.Send(command, ct);
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await mediator.Send(new DeletePerson(id), ct);
        return NoContent();
    }

    [HttpGet("legacy/{kind}/{legacyId:guid}")]
    public async Task<ActionResult<Guid>> ResolveLegacy(string kind, Guid legacyId, CancellationToken ct) =>
        Ok(await mediator.Send(new ResolveLegacyPerson(kind, legacyId), ct));
}