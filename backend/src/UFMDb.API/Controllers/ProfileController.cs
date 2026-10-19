using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Reviews;
using UFMDb.Application.Features.Users;
using Microsoft.AspNetCore.RateLimiting;

namespace UFMDb.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly ISender _mediator;
        private readonly ICurrentUserService _currentUser;
        private readonly IImageStorage _images;

        public ProfileController(ISender mediator, ICurrentUserService currentUser, IImageStorage images)
        {
            _mediator = mediator;
            _currentUser = currentUser;
            _images = images;
        }

        private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanıcı kimliği doğrulanamadı.");

        [HttpGet]
        public async Task<IActionResult> GetMyProfile()
            => Ok(await _mediator.Send(new GetProfileQuery(RequireUserId())));

        [HttpPut]
        public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request)
        {
            await _mediator.Send(new UpdateProfileCommand(
                RequireUserId(), request.UserName, request.AvatarUrl,
                request.FullName, request.Country, request.BirthDate, request.Gender, request.Biography));
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

        [HttpDelete]
        public async Task<IActionResult> DeleteAccount(DeleteAccountRequest request)
        {
            await _mediator.Send(new DeleteAccountCommand(RequireUserId(), request.Password));
            return NoContent();
        }

        [HttpGet("watched-films")]
        public async Task<IActionResult> GetWatchedFilms([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? sortBy = null, [FromQuery] bool? hasRating = null)
        => Ok(await _mediator.Send(new GetUserWatchedMoviesQuery(RequireUserId(), page, pageSize, sortBy, hasRating)));

        // all / rated / unrated sayıları: liste sorgusunu 3 kez çağırmak yerine tek hafif istek.
        [HttpGet("watched-films/counts")]
        public async Task<IActionResult> GetWatchedFilmsCounts()
            => Ok(await _mediator.Send(new GetWatchedFilmsCountsQuery(RequireUserId())));

        [HttpDelete("watched-films/{movieId:guid}")]
        public async Task<IActionResult> RemoveWatchedFilm(Guid movieId)
        {
            await _mediator.Send(new RemoveWatchedMovieCommand(RequireUserId(), movieId));
            return NoContent();
        }

        [HttpGet("liked-reviews")]
        public async Task<IActionResult> GetLikedReviews()
        => Ok(await _mediator.Send(new GetLikedReviewsQuery(RequireUserId())));

        [HttpPost("avatar")]
        [EnableRateLimiting("ImageUpload")]
        [RequestSizeLimit(6 * 1024 * 1024)]
        public async Task<IActionResult> UploadAvatar(IFormFile file, CancellationToken ct)
        {
            if (file is null || file.Length == 0)
                return BadRequest("Dosya seçilmedi.");

            await using var stream = file.OpenReadStream();
            var url = await _images.SaveAsync(stream, ImageKind.Avatar, ct);
            return Ok(new { avatarUrl = url });
        }
    }

    public record DeleteAccountRequest(string Password);
    public record UpdateUserSettingsRequest(string Language, string Theme);
    public record UpdateProfileRequest(
        string UserName, string? AvatarUrl,
        string? FullName, string? Country, DateTime? BirthDate, string? Gender, string? Biography
    );
}
