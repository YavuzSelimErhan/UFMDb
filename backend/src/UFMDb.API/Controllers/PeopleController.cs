using MediatR;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Features.People;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/people")]
public class PeopleController(ISender mediator) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        Ok(await mediator.Send(new GetPerson(id, Request.GetLang()), ct));
}
