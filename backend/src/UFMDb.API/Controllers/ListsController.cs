using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using UFMDb.Application.Features.Lists;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ListsController : ControllerBase
{
    private readonly ISender _mediator;
    public ListsController(ISender mediator) => _mediator = mediator;

    [HttpGet]
    [OutputCache(PolicyName = "Lists")]
    public async Task<IActionResult> GetLists() => Ok(await _mediator.Send(new GetListsQuery()));

    [HttpGet("{id:guid}")]
    [OutputCache(PolicyName = "Lists")]
    public async Task<IActionResult> GetById(Guid id) => Ok(await _mediator.Send(new GetListDetailQuery(id)));

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateListCommand command)
        => Ok(await _mediator.Send(command));

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateListCommand command)
    {
        if (id != command.Id) return BadRequest("Id uyuþmuyor.");
        await _mediator.Send(command);
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _mediator.Send(new DeleteListCommand(id));
        return NoContent();
    }
}