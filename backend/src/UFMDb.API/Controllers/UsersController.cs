using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Users;
using UFMDb.Domain.Enums;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private readonly ISender _mediator;
    private readonly ICurrentUserService _currentUser;

    public UsersController(ISender mediator, ICurrentUserService currentUser)
    {
        _mediator = mediator;
        _currentUser = currentUser;
    }

    private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanıcı kimliği doğrulanamadı.");

    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _mediator.Send(new GetUsersQuery(search, page, pageSize)));

    [HttpPut("{id:guid}/role")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateUserRoleRequest request)
    {
        if (!Enum.TryParse<UserRole>(request.Role, ignoreCase: true, out var role))
            return BadRequest("Geçersiz rol değeri.");

        await _mediator.Send(new UpdateUserRoleCommand(id, RequireUserId(), role));
        return NoContent();
    }

    [HttpPut("{id:guid}/toggle-active")]
    public async Task<ActionResult<bool>> ToggleActive(Guid id)
        => Ok(await _mediator.Send(new ToggleUserActiveCommand(id, RequireUserId())));
}

public record UpdateUserRoleRequest(string Role);
