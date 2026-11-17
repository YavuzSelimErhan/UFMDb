using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Features.Reviews;
using UFMDb.Application.Features.Users;
using Microsoft.AspNetCore.RateLimiting;
using UFMDb.Domain.Enums;

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
        private const long MaxImportFileBytes = 1024 * 1024;

        public ProfileController(ISender mediator, ICurrentUserService currentUser, IImageStorage images)
        {
            _mediator = mediator;
            _currentUser = currentUser;
            _images = images;
        }

        private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanıcı kimliği doğrulanamadı.");

        [HttpGet]
        public async Task<IActionResult> GetMyProfile()
            => Ok(await _mediator.Send(new GetProfileQuery(RequireUserId(), Request.GetLang())));

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

        [HttpPut("diary-visibility")]
        public async Task<IActionResult> UpdateDiaryVisibility(UpdateDiaryVisibilityRequest request)
        {
            if (!Enum.TryParse<DiaryVisibility>(request.Visibility, true, out var visibility) || !Enum.IsDefined(visibility))
                throw new ValidationException("Visibility", "Geçersiz gizlilik değeri.");
            await _mediator.Send(new UpdateDiaryVisibilityCommand(RequireUserId(), visibility));
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
        => Ok(await _mediator.Send(new GetUserWatchedMoviesQuery(RequireUserId(), page, pageSize, sortBy, hasRating, Request.GetLang())));

        // all / rated / unrated sayıları: liste sorgusunu 3 kez çağırmak yerine tek hafif istek.
        [HttpGet("watched-films/counts")]
        public async Task<IActionResult> GetWatchedFilmsCounts()
    => Ok(await _mediator.Send(new GetWatchedFilmsCountsQuery(RequireUserId(), RequireUserId())));

        [HttpPut("cover")]
        public async Task<IActionResult> SetCover(SetCoverRequest request)
        {
            await _mediator.Send(new SetProfileCoverCommand(RequireUserId(), request.MovieId));
            return NoContent();
        }

        [HttpDelete("watched-films/{movieId:guid}")]
        public async Task<IActionResult> RemoveWatchedFilm(Guid movieId)
        {
            await _mediator.Send(new RemoveWatchedMovieCommand(RequireUserId(), movieId));
            return NoContent();
        }

        [HttpGet("liked-reviews")]
        public async Task<IActionResult> GetLikedReviews()
        => Ok(await _mediator.Send(new GetLikedReviewsQuery(RequireUserId(), Request.GetLang())));

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

        /// <summary>Kendi watchlist'ini CSV olarak indirir.</summary>
        [HttpGet("watchlist/export")]
        public async Task<IActionResult> ExportWatchlist(CancellationToken ct)
        {
            var file = await _mediator.Send(new ExportWatchlistQuery(RequireUserId()), ct);
            Response.Headers.CacheControl = "no-store";
            return File(file.Content, "text/csv; charset=utf-8", file.FileName);
        }

        /// <summary>CSV'den (UFMDb / IMDb / Letterboxd) watchlist'e film ekler.</summary>
        [HttpPost("watchlist/import")]
        [EnableRateLimiting("WatchlistImport")]
        [RequestSizeLimit(MaxImportFileBytes + 64 * 1024)] // dosya + multipart zarfı
        public async Task<IActionResult> ImportWatchlist(IFormFile file, CancellationToken ct)
        {
            if (file is null || file.Length == 0)
                return BadRequest("Dosya seçilmedi.");
            if (file.Length > MaxImportFileBytes)
                throw new ValidationException("File", "Dosya 1 MB'ı geçemez.");

            using var ms = new MemoryStream((int)file.Length);
            await using (var stream = file.OpenReadStream())
                await stream.CopyToAsync(ms, ct);

            return Ok(await _mediator.Send(new ImportWatchlistCommand(RequireUserId(), ms.ToArray()), ct));
        }

        /// <summary>Kendi watchlist'ini tamamen temizler.</summary>
        [HttpDelete("watchlist")]
        public async Task<IActionResult> ClearWatchlist(CancellationToken ct)
            => Ok(new { removed = await _mediator.Send(new ClearWatchlistCommand(RequireUserId()), ct) });
    }

    public record DeleteAccountRequest(string Password);
    public record UpdateUserSettingsRequest(string Language, string Theme);
    public record UpdateProfileRequest(
        string UserName, string? AvatarUrl,
        string? FullName, string? Country, DateTime? BirthDate, string? Gender, string? Biography
    );
    public record UpdateDiaryVisibilityRequest(string Visibility);
    public record SetCoverRequest(Guid? MovieId);
}