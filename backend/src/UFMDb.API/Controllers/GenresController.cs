using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using UFMDb.Application.Features.Genres;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GenresController : ControllerBase
{
    private readonly ISender _mediator;
    public GenresController(ISender mediator) => _mediator = mediator;

    [HttpGet]
    [OutputCache(PolicyName = "Genres")]
    public async Task<IActionResult> GetGenres() => Ok(await _mediator.Send(new GetGenresQuery()));
}