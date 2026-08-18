using MediatR;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Features.Auth;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ISender _mediator;
    public AuthController(ISender mediator) => _mediator = mediator;

    [HttpPost("register")]
    public async Task<ActionResult<AuthResultDto>> Register(RegisterCommand command)
        => Ok(await _mediator.Send(command));

    [HttpPost("login")]
    public async Task<ActionResult<AuthResultDto>> Login(LoginCommand command)
        => Ok(await _mediator.Send(command));
}
