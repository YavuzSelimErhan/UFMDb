using MediatR;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Features.Countries;
namespace UFMDb.API.Controllers;
[ApiController]
[Route("api/[controller]")]
public class CountriesController : ControllerBase
{
    private readonly ISender _mediator;
    public CountriesController(ISender mediator) => _mediator = mediator;
    [HttpGet]
    public async Task<IActionResult> GetCountries() => Ok(await _mediator.Send(new GetCountriesQuery()));
}