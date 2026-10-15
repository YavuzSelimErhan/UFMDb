using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Lists;
using UFMDb.Domain.Enums;
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

    private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanıcı kimliği doğrulanamadı.");

    [HttpGet]
    public async Task<IActionResult> GetLists(
        [FromQuery] ListScope scope = ListScope.Official, [FromQuery] ListSort sort = ListSort.Default,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 24, CancellationToken ct = default)
        => Ok(await _mediator.Send(new GetListsQuery(scope, _currentUser.UserId, null, sort, page, pageSize), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetListDetailQuery(id, _currentUser.UserId, _currentUser.IsAdmin), ct));

    [HttpGet("by-slug/{slug}")]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken ct)
        => Ok(await _mediator.Send(new GetListDetailBySlugQuery(slug, _currentUser.UserId, _currentUser.IsAdmin), ct));

    [Authorize]
    [HttpGet("for-movie/{movieId:guid}")]
    public async Task<IActionResult> GetMyListsForMovie(Guid movieId, CancellationToken ct)
        => Ok(await _mediator.Send(new GetMyListsForMovieQuery(movieId, RequireUserId()), ct));

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<ListCreatedDto>> Create(CreateListRequest request, CancellationToken ct)
    {
        var userId = RequireUserId();
        // Sadece Admin isOfficial=true ile liste oluşturabilir.
        var isOfficial = _currentUser.IsAdmin && request.IsOfficial;
        var command = new CreateListCommand(
            request.Title, request.TitleTr, request.Description ?? "", request.DescriptionTr ?? "",
            request.CoverImageUrl ?? "", request.DisplayOrder, request.IsRanked,
            request.Visibility, request.Status, ToInputs(request.Items), userId, isOfficial);
        return Ok(await _mediator.Send(command, ct));
    }

    [Authorize]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateListRequest request, CancellationToken ct)
    {
        var command = new UpdateListCommand(
            id, request.Title, request.TitleTr, request.Description ?? "", request.DescriptionTr ?? "",
            request.CoverImageUrl ?? "", request.DisplayOrder, request.IsRanked,
            request.Visibility, request.Status, ToInputs(request.Items), RequireUserId(), _currentUser.IsAdmin);
        await _mediator.Send(command, ct);
        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteListCommand(id, RequireUserId(), _currentUser.IsAdmin), ct);
        return NoContent();
    }

    [Authorize]
    [HttpPost("{id:guid}/items")]
    public async Task<IActionResult> AddItem(Guid id, AddListItemRequest request, CancellationToken ct)
    {
        await _mediator.Send(new AddMovieToListCommand(
            id, request.MovieId, request.Note, request.NoteTr, RequireUserId(), _currentUser.IsAdmin), ct);
        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id:guid}/items/{movieId:guid}")]
    public async Task<IActionResult> RemoveItem(Guid id, Guid movieId, CancellationToken ct)
    {
        await _mediator.Send(new RemoveMovieFromListCommand(id, movieId, RequireUserId(), _currentUser.IsAdmin), ct);
        return NoContent();
    }

    [Authorize]
    [HttpPost("{id:guid}/like")]
    public async Task<ActionResult<bool>> ToggleLike(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new ToggleListLikeCommand(id, RequireUserId()), ct));

    // Anonim erişim açık; görünürlük handler'da viewer'a göre filtreleniyor.
    [HttpGet("~/api/users/{userId:guid}/lists")]
    [AllowAnonymous]
    public async Task<IActionResult> GetUserLists(
        Guid userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 24, CancellationToken ct = default)
        => Ok(await _mediator.Send(
            new GetListsQuery(ListScope.User, _currentUser.UserId, userId, ListSort.Newest, page, pageSize), ct));

    private static List<ListItemInput> ToInputs(List<ListItemRequest>? items) =>
        (items ?? new()).Select(i => new ListItemInput(i.MovieId, i.Note, i.NoteTr)).ToList();
}

public record ListItemRequest(Guid MovieId, string? Note, string? NoteTr);
public record AddListItemRequest(Guid MovieId, string? Note, string? NoteTr);

public record CreateListRequest(
    string Title, string TitleTr, string? Description, string? DescriptionTr, string? CoverImageUrl,
    int DisplayOrder, bool IsRanked, ListVisibility Visibility, ListStatus Status,
    List<ListItemRequest> Items, bool IsOfficial);

public record UpdateListRequest(
    string Title, string TitleTr, string? Description, string? DescriptionTr, string? CoverImageUrl,
    int DisplayOrder, bool IsRanked, ListVisibility Visibility, ListStatus Status,
    List<ListItemRequest> Items);