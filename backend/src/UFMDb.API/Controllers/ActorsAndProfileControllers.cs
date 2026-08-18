using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Actors;
using UFMDb.Application.Features.Users;


namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ActorsController : ControllerBase
{
    private readonly ISender _mediator;
    private readonly ICurrentUserService _currentUser;

    public ActorsController(ISender mediator, ICurrentUserService currentUser)
    {
        _mediator = mediator;
        _currentUser = currentUser;
    }

    private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanıcı kimliği doğrulanamadı.");

    [HttpGet]
    public async Task<IActionResult> GetActors([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _mediator.Send(new GetActorsQuery(search, page, pageSize)));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
        => Ok(await _mediator.Send(new GetActorDetailQuery(id, _currentUser.UserId)));

    [Authorize]
    [HttpPost("{id:guid}/like")]
    public async Task<ActionResult<bool>> ToggleLike(Guid id)
        => Ok(await _mediator.Send(new ToggleActorLikeCommand(id, RequireUserId())));

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Create(CreateActorCommand command)
        => Ok(await _mediator.Send(command));

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateActorCommand command)
    {
        if (id != command.Id) return BadRequest("Id uyuşmuyor.");
        await _mediator.Send(command);
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _mediator.Send(new DeleteActorCommand(id));
        return NoContent();
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ISender _mediator;
    private readonly ICurrentUserService _currentUser;
    private readonly IWebHostEnvironment _env;

    public ProfileController(ISender mediator, ICurrentUserService currentUser, IWebHostEnvironment env)
    {
        _mediator = mediator;
        _currentUser = currentUser;
        _env = env;
    }

    private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanıcı kimliği doğrulanamadı.");

    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
    private const long MaxFileSizeBytes = 5 * 1024 * 1024;

    [HttpGet]
    public async Task<IActionResult> GetMyProfile()
        => Ok(await _mediator.Send(new GetProfileQuery(RequireUserId())));

    [HttpPut]
    public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request)
    {
        await _mediator.Send(new UpdateProfileCommand(RequireUserId(), request.UserName, request.AvatarUrl));
        return NoContent();
    }

    [HttpPut("favorites/{slot:int}")]
    public async Task<IActionResult> SetFavorite(int slot, [FromBody] Guid movieId)
    {
        await _mediator.Send(new SetFavoriteMovieCommand(RequireUserId(), movieId, slot));
        return NoContent();
    }

    [HttpDelete("favorites/{slot:int}")]
    public async Task<IActionResult> RemoveFavorite(int slot)
    {
        await _mediator.Send(new RemoveFavoriteMovieCommand(RequireUserId(), slot));
        return NoContent();
    }

    [HttpPut("favorite-actors/{slot:int}")]
    public async Task<IActionResult> SetFavoriteActor(int slot, [FromBody] Guid actorId)
    {
        await _mediator.Send(new SetFavoriteActorCommand(RequireUserId(), actorId, slot));
        return NoContent();
    }

    [HttpDelete("favorite-actors/{slot:int}")]
    public async Task<IActionResult> RemoveFavoriteActor(int slot)
    {
        await _mediator.Send(new RemoveFavoriteActorCommand(RequireUserId(), slot));
        return NoContent();
    }

    [HttpPut("favorite-directors/{slot:int}")]
    public async Task<IActionResult> SetFavoriteDirector(int slot, [FromBody] Guid directorId)
    {
        await _mediator.Send(new SetFavoriteDirectorCommand(RequireUserId(), directorId, slot));
        return NoContent();
    }

    [HttpDelete("favorite-directors/{slot:int}")]
    public async Task<IActionResult> RemoveFavoriteDirector(int slot)
    {
        await _mediator.Send(new RemoveFavoriteDirectorCommand(RequireUserId(), slot));
        return NoContent();
    }

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings(UpdateUserSettingsRequest request)
    {
        await _mediator.Send(new UpdateUserSettingsCommand(RequireUserId(), request.Language, request.Theme));
        return NoContent();
    }

    [HttpGet("watched-films")]
    public async Task<IActionResult> GetWatchedFilms([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? sortBy = null, [FromQuery] bool? hasRating = null)
    => Ok(await _mediator.Send(new GetUserWatchedMoviesQuery(RequireUserId(), page, pageSize, sortBy, hasRating)));

    [HttpPost("avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Dosya seçilmedi.");

        if (file.Length > MaxFileSizeBytes)
            return BadRequest("Dosya boyutu 5 MB'ı geçemez.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
            return BadRequest("Sadece jpg, png, webp veya gif dosyaları yüklenebilir.");

        var userId = RequireUserId();
        var fileName = $"{userId}-{Guid.NewGuid()}{extension}";

        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadsFolder = Path.Combine(webRoot, "uploads", "avatars");
        Directory.CreateDirectory(uploadsFolder);

        var filePath = Path.Combine(uploadsFolder, fileName);
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var relativeUrl = $"/api/uploads/avatars/{fileName}";
        return Ok(new { avatarUrl = relativeUrl });
    }
}

public record UpdateUserSettingsRequest(string Language, string Theme);
public record UpdateProfileRequest(string UserName, string? AvatarUrl);
