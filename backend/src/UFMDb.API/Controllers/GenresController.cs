using MediatR;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Features.Genres;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GenresController : ControllerBase
{
    private readonly ISender _mediator;
    public GenresController(ISender mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> GetGenres() => Ok(await _mediator.Send(new GetGenresQuery()));
}
