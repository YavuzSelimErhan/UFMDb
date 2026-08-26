using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Lists;
namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ListsController : ControllerBase
{
    private readonly ISender _mediator;
    private readonly ICurrentUserService _currentUser;
    public ListsController(ISender mediator, ICurrentUserService currentUser)
    {
        _mediator = mediator;
        _currentUser = currentUser;
    }

    private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanýcý kimliði doðrulanamadý.");

    [HttpGet]
    public async Task<IActionResult> GetLists([FromQuery] ListScope scope = ListScope.Official)
        => Ok(await _mediator.Send(new GetListsQuery(scope, _currentUser.UserId)));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id) => Ok(await _mediator.Send(new GetListDetailQuery(id, _currentUser.UserId)));

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateListRequest request)
    {
        var userId = RequireUserId();
        // Sadece Admin, isOfficial=true ile liste oluþturabilir; normal kullanýcý ne gönderirse göndersin false'a sabitleniyor.
        var isOfficial = _currentUser.IsAdmin && request.IsOfficial;
        var command = new CreateListCommand(
            request.Title, request.TitleTr, request.Description, request.CoverImageUrl,
            request.DisplayOrder, request.MovieIds, userId, isOfficial);
        return Ok(await _mediator.Send(command));
    }

    [Authorize]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateListRequest request)
    {
        var command = new UpdateListCommand(
            id, request.Title, request.TitleTr, request.Description, request.CoverImageUrl,
            request.DisplayOrder, request.MovieIds, RequireUserId(), _currentUser.IsAdmin);
        await _mediator.Send(command);
        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _mediator.Send(new DeleteListCommand(id, RequireUserId(), _currentUser.IsAdmin));
        return NoContent();
    }

    [Authorize]
    [HttpPost("{id:guid}/like")]
    public async Task<ActionResult<bool>> ToggleLike(Guid id)
        => Ok(await _mediator.Send(new ToggleListLikeCommand(id, RequireUserId())));
}

public record CreateListRequest(string Title, string TitleTr, string Description, string CoverImageUrl, int DisplayOrder, List<Guid> MovieIds, bool IsOfficial);
public record UpdateListRequest(string Title, string TitleTr, string Description, string CoverImageUrl, int DisplayOrder, List<Guid> MovieIds);