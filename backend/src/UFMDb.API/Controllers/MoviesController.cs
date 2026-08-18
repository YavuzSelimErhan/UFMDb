using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Application.Features.Movies.GetMovieDetail;
using UFMDb.Application.Features.Movies.GetMovies;
using UFMDb.Application.Features.Movies.HomeFeed;
using UFMDb.Application.Features.Movies.ManageMovie;
using UFMDb.Application.Features.Reviews;
using UFMDb.Domain.Entities;

namespace UFMDb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MoviesController : ControllerBase
{
    private readonly ISender _mediator;
    private readonly ICurrentUserService _currentUser;

    public MoviesController(ISender mediator, ICurrentUserService currentUser)
    {
        _mediator = mediator;
        _currentUser = currentUser;
    }

    /// <summary>[Authorize] altındaki endpoint'lerde UserId'nin garanti dolu olduğunu netleştirir.</summary>
    private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedException("Kullanıcı kimliği doğrulanamadı.");

    /// <summary>Gelişmiş arama: isim, tür, yıl, oyuncu, puan filtreleri</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<MovieListItemDto>>> GetMovies([FromQuery] MovieSearchQueryDto filter)
    {
        Guid? userId = User.Identity?.IsAuthenticated == true ? RequireUserId() : null;
        return Ok(await _mediator.Send(new GetMoviesQuery(filter, userId)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MovieDetailDto>> GetById(Guid id)
        => Ok(await _mediator.Send(new GetMovieDetailQuery(id, _currentUser.UserId)));

    [HttpGet("home-feed")]
    public async Task<ActionResult<HomeFeedDto>> GetHomeFeed()
    {
        Guid? userId = User.Identity?.IsAuthenticated == true ? RequireUserId() : null;
        return Ok(await _mediator.Send(new GetHomeFeedQuery(userId)));
    }

    // ---------------- Kullanıcı etkileşimleri ----------------

    [Authorize]
    [HttpPost("{id:guid}/like")]
    public async Task<ActionResult<bool>> ToggleLike(Guid id)
        => Ok(await _mediator.Send(new ToggleLikeCommand(id, RequireUserId())));

    [Authorize]
    [HttpPost("{id:guid}/watchlist")]
    public async Task<ActionResult<bool>> ToggleWatchlist(Guid id)
        => Ok(await _mediator.Send(new ToggleWatchlistCommand(id, RequireUserId())));

    [Authorize]
    [HttpPost("{id:guid}/watched")]
    public async Task<ActionResult<bool>> ToggleWatched(Guid id)
        => Ok(await _mediator.Send(new ToggleWatchedCommand(id, RequireUserId())));

    [Authorize]
    [HttpPost("{id:guid}/rating")]
    public async Task<IActionResult> UpsertRating(Guid id, [FromBody] RatingRequest request)
    {
        await _mediator.Send(new UpsertRatingCommand(id, RequireUserId(), request.Value));
        return NoContent();
    }

    [Authorize]
    [HttpPost("{id:guid}/reviews")]
    public async Task<ActionResult<Guid>> UpsertReview(Guid id, [FromBody] ReviewRequest request)
        => Ok(await _mediator.Send(new UpsertReviewCommand(id, RequireUserId(), request.Content, request.ContainsSpoiler)));

    [Authorize]
    [HttpDelete("{id:guid}/reviews")]
    public async Task<IActionResult> DeleteReview(Guid id)
    {
        await _mediator.Send(new DeleteReviewCommand(id, RequireUserId()));
        return NoContent();
    }

    // ---------------- Admin: Film yönetimi ----------------

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateMovieCommand command)
        => Ok(await _mediator.Send(command));

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateMovieCommand command)
    {
        if (id != command.Id) return BadRequest("Id uyuşmuyor.");
        await _mediator.Send(command);
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _mediator.Send(new DeleteMovieCommand(id));
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("recalculate-ratings")]
    public async Task<ActionResult<int>> RecalculateRatings()
    => Ok(await _mediator.Send(new RecalculateAllRatingsCommand()));
}

public record ReviewRequest(string Content, bool ContainsSpoiler);
public record RatingRequest(decimal Value);
