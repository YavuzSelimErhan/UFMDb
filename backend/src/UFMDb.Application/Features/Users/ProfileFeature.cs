using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.Common.Services;
using UFMDb.Application.DTOs;
using UFMDb.Application.Features.Actors;
using UFMDb.Domain.Entities;


namespace UFMDb.Application.Features.Users;

public record FavoriteSlotDto(int Slot, MovieListItemDto? Movie);
public record FavoriteActorSlotDto(int Slot, ActorListItemDto? Actor);
public record ReviewSummaryDto(Guid Id, Guid MovieId, string MovieTitle, string PosterUrl, string Content, bool ContainsSpoiler, DateTime CreatedAtUtc);
public record FavoriteDirectorSlotDto(int Slot, DirectorListItemDto? Director);


public record RecentlyWatchedItemDto(MovieListItemDto Movie, decimal? UserRating);

public record ProfileDto(
    Guid UserId, string UserName, string? AvatarUrl, string PreferredLanguage, string PreferredTheme,
    List<FavoriteSlotDto> FavoriteMovies,
    List<RecentlyWatchedItemDto> RecentlyWatched,   // <-- tip değişti
    List<MovieListItemDto> LikedMovies,
    List<MovieListItemDto> Watchlist,
    List<ReviewSummaryDto> Reviews,
    List<FavoriteActorSlotDto> FavoriteActors,
    List<ActorListItemDto> LikedActors,
    List<FavoriteDirectorSlotDto> FavoriteDirectors,
    List<DirectorListItemDto> LikedDirectors,
    int TotalWatchedCount,
    decimal? AverageGivenRating,   // <-- yeni
    int RatingsCount,              // <-- yeni
    DateTime MemberSinceUtc
);

public record GetProfileQuery(Guid UserId) : IRequest<ProfileDto>;

public class GetProfileQueryHandler : IRequestHandler<GetProfileQuery, ProfileDto>
{
    private readonly IApplicationDbContext _context;
    public GetProfileQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<ProfileDto> Handle(GetProfileQuery request, CancellationToken ct)
    {
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw new NotFoundException(nameof(User), request.UserId);

        // NOT: EF Core, IQueryable üzerinde yerel bir C# metodunu (ToListItem) SQL'e çeviremez.
        // Bu yüzden önce ilgili navigation'ları Include ederek veriyi materialize ediyoruz,
        // ardından DTO dönüşümünü bellek içinde (client-side) yapıyoruz.
        var favoriteEntities = await _context.FavoriteMovies.AsNoTracking()
            .Include(f => f.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Where(f => f.UserId == request.UserId)
            .ToListAsync(ct);

        // Her zaman 4 sabit slot döndürülür (1-4); dolu olmayan slotlar Movie=null olarak gelir.
        var favorites = Enumerable.Range(1, 4)
            .Select(slot =>
            {
                var match = favoriteEntities.FirstOrDefault(f => f.Slot == slot);
                return new FavoriteSlotDto(slot, match is null ? null : ToListItem(match.Movie));
            })
            .ToList();

        var recent = await _context.WatchHistory.AsNoTracking()
            .Include(w => w.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Where(w => w.UserId == request.UserId)
            .OrderByDescending(w => w.WatchedAtUtc).Take(4)
            .ToListAsync(ct);

        var totalWatchedCount = await _context.WatchHistory.AsNoTracking()
            .CountAsync(w => w.UserId == request.UserId, ct);

        var liked = await _context.Likes.AsNoTracking()
            .Include(l => l.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Where(l => l.UserId == request.UserId)
            .OrderByDescending(l => l.CreatedAtUtc)
            .ToListAsync(ct);

        var watchlist = await _context.WatchlistItems.AsNoTracking()
            .Include(w => w.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Where(w => w.UserId == request.UserId)
            .OrderByDescending(w => w.CreatedAtUtc)
            .ToListAsync(ct);

        var ratedEntries = await _context.WatchHistory.AsNoTracking()
    .Where(w => w.UserId == request.UserId && w.Rating != null)
    .ToListAsync(ct);

        var userRatingsLookup = ratedEntries
            .GroupBy(w => w.MovieId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(w => w.WatchedAtUtc).First().Rating!.Value);

        var averageGivenRating = userRatingsLookup.Count > 0 ? Math.Round(userRatingsLookup.Values.Average(), 2) : (decimal?)null;
        var ratingsCount = userRatingsLookup.Count;

        var recentlyWatched = recent.Select(w => new RecentlyWatchedItemDto(
            ToListItem(w.Movie), w.Rating
        )).ToList();

        var reviewEntities = await _context.Reviews.AsNoTracking()
            .Include(r => r.Movie)
            .Where(r => r.UserId == request.UserId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToListAsync(ct);
        var reviews = reviewEntities.Select(r => new ReviewSummaryDto(
            r.Id, r.MovieId, r.Movie.Title, r.Movie.PosterUrl, r.Content, r.ContainsSpoiler, r.CreatedAtUtc)).ToList();

        var favoriteActorEntities = await _context.FavoriteActors.AsNoTracking()
            .Include(f => f.Actor)
            .Where(f => f.UserId == request.UserId)
            .ToListAsync(ct);
        var favoriteActors = Enumerable.Range(1, 4)
            .Select(slot =>
            {
                var match = favoriteActorEntities.FirstOrDefault(f => f.Slot == slot);
                return new FavoriteActorSlotDto(slot, match is null ? null : new ActorListItemDto(match.Actor.Id, match.Actor.FullName, match.Actor.PhotoUrl, match.Actor.Nationality));
            })
            .ToList();

        var likedActors = await _context.ActorLikes.AsNoTracking()
            .Include(l => l.Actor)
            .Where(l => l.UserId == request.UserId)
            .OrderByDescending(l => l.CreatedAtUtc)
            .Select(l => new ActorListItemDto(l.Actor.Id, l.Actor.FullName, l.Actor.PhotoUrl, l.Actor.Nationality))
            .ToListAsync(ct);

        var favoriteDirectorEntities = await _context.FavoriteDirectors.AsNoTracking()
    .Include(f => f.Director)
    .Where(f => f.UserId == request.UserId)
    .ToListAsync(ct);
        var favoriteDirectors = Enumerable.Range(1, 4)
            .Select(slot =>
            {
                var match = favoriteDirectorEntities.FirstOrDefault(f => f.Slot == slot);
                return new FavoriteDirectorSlotDto(slot, match is null ? null : new DirectorListItemDto(match.Director.Id, match.Director.FullName, match.Director.PhotoUrl, match.Director.Nationality));
            })
            .ToList();

        var likedDirectors = await _context.DirectorLikes.AsNoTracking()
            .Include(l => l.Director)
            .Where(l => l.UserId == request.UserId)
            .OrderByDescending(l => l.CreatedAtUtc)
            .Select(l => new DirectorListItemDto(l.Director.Id, l.Director.FullName, l.Director.PhotoUrl, l.Director.Nationality))
            .ToListAsync(ct);

        return new ProfileDto(
            user.Id, user.UserName, user.AvatarUrl, user.PreferredLanguage, user.PreferredTheme,
            favorites,
            recentlyWatched,                                 
            liked.Select(l => ToListItem(l.Movie)).ToList(),
            watchlist.Select(w => ToListItem(w.Movie)).ToList(),
            reviews,
            favoriteActors,
            likedActors,
            favoriteDirectors,
            likedDirectors,
            totalWatchedCount,
            averageGivenRating,                        
            ratingsCount,                   
            user.CreatedAtUtc
        );
    }

    private static MovieListItemDto ToListItem(Movie m) => new(
        m.Id, m.Title, m.ReleaseYear, m.PosterUrl, m.AverageRating, m.RatingCount,
        m.MovieGenres.Select(g => g.Genre.Name).ToList(), m.BackdropUrl, m.Overview);
}

// ---------- Favori film slotunu güncelle (1-4) ----------
public record SetFavoriteMovieCommand(Guid UserId, Guid MovieId, int Slot) : IRequest;

public class SetFavoriteMovieCommandHandler : IRequestHandler<SetFavoriteMovieCommand>
{
    private readonly IApplicationDbContext _context;
    public SetFavoriteMovieCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(SetFavoriteMovieCommand request, CancellationToken ct)
    {
        if (request.Slot is < 1 or > 4)
            throw new Common.Exceptions.ValidationException(new Dictionary<string, string[]>
            {
                ["Slot"] = new[] { "Slot değeri 1 ile 4 arasında olmalıdır." }
            });

        var existing = await _context.FavoriteMovies
            .FirstOrDefaultAsync(f => f.UserId == request.UserId && f.Slot == request.Slot, ct);

        if (existing is not null) _context.FavoriteMovies.Remove(existing);

        _context.FavoriteMovies.Add(new FavoriteMovie { UserId = request.UserId, MovieId = request.MovieId, Slot = request.Slot });
        await _context.SaveChangesAsync(ct);
    }
}

// ---------- Kullanıcı adı ve profil resmini güncelle ----------
public record UpdateProfileCommand(Guid UserId, string UserName, string? AvatarUrl) : IRequest;

public class UpdateProfileCommandValidator : AbstractValidator<UpdateProfileCommand>
{
    public UpdateProfileCommandValidator()
    {
        RuleFor(x => x.UserName).NotEmpty().MinimumLength(3).MaximumLength(50);
        RuleFor(x => x.AvatarUrl).MaximumLength(500);
    }
}

public class UpdateProfileCommandHandler : IRequestHandler<UpdateProfileCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateProfileCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateProfileCommand request, CancellationToken ct)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw new NotFoundException(nameof(User), request.UserId);

        if (!string.Equals(user.UserName, request.UserName, StringComparison.OrdinalIgnoreCase))
        {
            var taken = await _context.Users.AnyAsync(u => u.UserName == request.UserName && u.Id != request.UserId, ct);
            if (taken) throw new ConflictException("Bu kullanıcı adı zaten kullanılıyor.");
            user.UserName = request.UserName;
        }

        user.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl;
        user.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}

// ---------- Favori film slotunu boşalt ----------
public record RemoveFavoriteMovieCommand(Guid UserId, int Slot) : IRequest;

public class RemoveFavoriteMovieCommandHandler : IRequestHandler<RemoveFavoriteMovieCommand>
{
    private readonly IApplicationDbContext _context;
    public RemoveFavoriteMovieCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(RemoveFavoriteMovieCommand request, CancellationToken ct)
    {
        var existing = await _context.FavoriteMovies
            .FirstOrDefaultAsync(f => f.UserId == request.UserId && f.Slot == request.Slot, ct);

        if (existing is not null)
        {
            _context.FavoriteMovies.Remove(existing);
            await _context.SaveChangesAsync(ct);
        }
    }
}

// ---------- Favori aktör slotunu güncelle (1-4) ----------
public record SetFavoriteActorCommand(Guid UserId, Guid ActorId, int Slot) : IRequest;

public class SetFavoriteActorCommandHandler : IRequestHandler<SetFavoriteActorCommand>
{
    private readonly IApplicationDbContext _context;
    public SetFavoriteActorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(SetFavoriteActorCommand request, CancellationToken ct)
    {
        if (request.Slot is < 1 or > 4)
            throw new Common.Exceptions.ValidationException(new Dictionary<string, string[]>
            {
                ["Slot"] = new[] { "Slot değeri 1 ile 4 arasında olmalıdır." }
            });

        var existing = await _context.FavoriteActors
            .FirstOrDefaultAsync(f => f.UserId == request.UserId && f.Slot == request.Slot, ct);

        if (existing is not null) _context.FavoriteActors.Remove(existing);

        _context.FavoriteActors.Add(new FavoriteActor { UserId = request.UserId, ActorId = request.ActorId, Slot = request.Slot });
        await _context.SaveChangesAsync(ct);
    }
}

// ---------- Favori aktör slotunu boşalt ----------
public record RemoveFavoriteActorCommand(Guid UserId, int Slot) : IRequest;

public class RemoveFavoriteActorCommandHandler : IRequestHandler<RemoveFavoriteActorCommand>
{
    private readonly IApplicationDbContext _context;
    public RemoveFavoriteActorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(RemoveFavoriteActorCommand request, CancellationToken ct)
    {
        var existing = await _context.FavoriteActors
            .FirstOrDefaultAsync(f => f.UserId == request.UserId && f.Slot == request.Slot, ct);

        if (existing is not null)
        {
            _context.FavoriteActors.Remove(existing);
            await _context.SaveChangesAsync(ct);
        }
    }
}

// ---------- Favori yönetmen slotunu güncelle (1-4) ----------
public record SetFavoriteDirectorCommand(Guid UserId, Guid DirectorId, int Slot) : IRequest;

public class SetFavoriteDirectorCommandHandler : IRequestHandler<SetFavoriteDirectorCommand>
{
    private readonly IApplicationDbContext _context;
    public SetFavoriteDirectorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(SetFavoriteDirectorCommand request, CancellationToken ct)
    {
        if (request.Slot is < 1 or > 4)
            throw new Common.Exceptions.ValidationException(new Dictionary<string, string[]>
            {
                ["Slot"] = new[] { "Slot değeri 1 ile 4 arasında olmalıdır." }
            });

        var existing = await _context.FavoriteDirectors
            .FirstOrDefaultAsync(f => f.UserId == request.UserId && f.Slot == request.Slot, ct);

        if (existing is not null) _context.FavoriteDirectors.Remove(existing);

        _context.FavoriteDirectors.Add(new FavoriteDirector { UserId = request.UserId, DirectorId = request.DirectorId, Slot = request.Slot });
        await _context.SaveChangesAsync(ct);
    }
}

// ---------- Favori yönetmen slotunu boşalt ----------
public record RemoveFavoriteDirectorCommand(Guid UserId, int Slot) : IRequest;

public class RemoveFavoriteDirectorCommandHandler : IRequestHandler<RemoveFavoriteDirectorCommand>
{
    private readonly IApplicationDbContext _context;
    public RemoveFavoriteDirectorCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(RemoveFavoriteDirectorCommand request, CancellationToken ct)
    {
        var existing = await _context.FavoriteDirectors
            .FirstOrDefaultAsync(f => f.UserId == request.UserId && f.Slot == request.Slot, ct);

        if (existing is not null)
        {
            _context.FavoriteDirectors.Remove(existing);
            await _context.SaveChangesAsync(ct);
        }
    }
}

// ---------- Kullanıcı ayarlarını güncelle (tema/dil) ----------
public record UpdateUserSettingsCommand(Guid UserId, string PreferredLanguage, string PreferredTheme) : IRequest;

public class UpdateUserSettingsCommandHandler : IRequestHandler<UpdateUserSettingsCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateUserSettingsCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateUserSettingsCommand request, CancellationToken ct)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw new NotFoundException(nameof(User), request.UserId);

        user.PreferredLanguage = request.PreferredLanguage;
        user.PreferredTheme = request.PreferredTheme;
        user.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}

public record WatchedMovieDto(Guid Id, MovieListItemDto Movie, DateTime WatchedAtUtc, decimal? UserRating);
public record GetUserWatchedMoviesQuery(Guid UserId, int Page, int PageSize, string? SortBy, bool? HasRating) : IRequest<PagedResult<WatchedMovieDto>>;

public class GetUserWatchedMoviesQueryHandler : IRequestHandler<GetUserWatchedMoviesQuery, PagedResult<WatchedMovieDto>>
{
    private readonly IApplicationDbContext _context;
    public GetUserWatchedMoviesQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PagedResult<WatchedMovieDto>> Handle(GetUserWatchedMoviesQuery request, CancellationToken ct)
    {
        var allEntries = await _context.WatchHistory.AsNoTracking()
            .Include(w => w.Movie).ThenInclude(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Where(w => w.UserId == request.UserId)
            .ToListAsync(ct);

        // Her film için en son seansı (en güncel izleme tarihi + o seansın puanı) alıyoruz.
        var perMovie = allEntries
            .GroupBy(w => w.MovieId)
            .Select(g => g.OrderByDescending(w => w.WatchedAtUtc).First())
            .AsEnumerable();

        if (request.HasRating is true) perMovie = perMovie.Where(w => w.Rating != null);
        if (request.HasRating is false) perMovie = perMovie.Where(w => w.Rating == null);

        perMovie = request.SortBy switch
        {
            "watched-asc" => perMovie.OrderBy(w => w.WatchedAtUtc),
            "rating-desc" => perMovie.OrderByDescending(w => w.Rating ?? -1),
            "rating-asc" => perMovie.OrderBy(w => w.Rating ?? -1),
            "title-asc" => perMovie.OrderBy(w => w.Movie.Title),
            _ => perMovie.OrderByDescending(w => w.WatchedAtUtc) // "watched-desc" varsayılan
        };

        var allSorted = perMovie.ToList();
        var totalCount = allSorted.Count;
        var page = allSorted.Skip((request.Page - 1) * request.PageSize).Take(request.PageSize).ToList();

        var items = page.Select(w => new WatchedMovieDto(
            w.Id,
            new MovieListItemDto(
                w.Movie.Id, w.Movie.Title, w.Movie.ReleaseYear, w.Movie.PosterUrl,
                w.Movie.AverageRating, w.Movie.RatingCount,
                w.Movie.MovieGenres.Select(mg => mg.Genre.Name).ToList(),
                w.Movie.BackdropUrl, w.Movie.Overview, false),
            w.WatchedAtUtc,
            w.Rating
        )).ToList();

        return new PagedResult<WatchedMovieDto>(items, totalCount, request.Page, request.PageSize);
    }
}
// ---------- Seans Defteri: gün gün gruplanmış, "double feature" ve rewatch numaralı ----------
public record ScreeningLogEntryDto(
    Guid Id, Guid MovieId, string MovieTitle, string PosterUrl, DateTime WatchedAtUtc,
    int ScreeningNumber, decimal? Rating, string? ReviewContent
);
public record ScreeningLogDayDto(DateTime Date, List<ScreeningLogEntryDto> Entries);

public record GetScreeningLogQuery(Guid UserId) : IRequest<List<ScreeningLogDayDto>>;

public class GetScreeningLogQueryHandler : IRequestHandler<GetScreeningLogQuery, List<ScreeningLogDayDto>>
{
    private readonly IApplicationDbContext _context;
    public GetScreeningLogQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<List<ScreeningLogDayDto>> Handle(GetScreeningLogQuery request, CancellationToken ct)
    {
        var entries = await _context.WatchHistory.AsNoTracking()
            .Include(w => w.Movie)
            .Where(w => w.UserId == request.UserId)
            .OrderBy(w => w.WatchedAtUtc)
            .ToListAsync(ct);

        var reviews = await _context.Reviews.AsNoTracking()
            .Where(r => r.UserId == request.UserId && !r.IsDeleted)
            .ToDictionaryAsync(r => r.MovieId, r => r.Content, ct);

        var watchCounts = new Dictionary<Guid, int>();
        var decorated = entries.Select(w =>
        {
            watchCounts.TryGetValue(w.MovieId, out var count);
            count++;
            watchCounts[w.MovieId] = count;
            return new ScreeningLogEntryDto(
                w.Id, w.MovieId, w.Movie.Title, w.Movie.PosterUrl, w.WatchedAtUtc, count,
                w.Rating, // artık doğrudan seans satırından — her rewatch kendi gerçek puanını taşıyor
                reviews.TryGetValue(w.MovieId, out var content) ? content : null
            );
        }).ToList();

        return decorated
            .GroupBy(e => e.WatchedAtUtc.Date)
            .OrderByDescending(g => g.Key)
            .Select(g => new ScreeningLogDayDto(g.Key, g.OrderBy(e => e.WatchedAtUtc).ToList()))
            .ToList();
    }
}

// ---------- Günlüğe ekle: artık isteğe bağlı puan da alabiliyor ----------
public record LogScreeningCommand(Guid UserId, Guid MovieId, DateTime WatchedAtUtc, decimal? Rating) : IRequest<Guid>;

public class LogScreeningCommandHandler : IRequestHandler<LogScreeningCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    public LogScreeningCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<Guid> Handle(LogScreeningCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Id == request.MovieId, ct)
            ?? throw new NotFoundException(nameof(Movie), request.MovieId);

        var entry = new WatchHistory { UserId = request.UserId, MovieId = request.MovieId, WatchedAtUtc = request.WatchedAtUtc, Rating = request.Rating };
        _context.WatchHistory.Add(entry);

        var watchlistEntry = await _context.WatchlistItems
            .FirstOrDefaultAsync(w => w.MovieId == request.MovieId && w.UserId == request.UserId, ct);
        if (watchlistEntry is not null) _context.WatchlistItems.Remove(watchlistEntry);

        await _context.SaveChangesAsync(ct);
        if (request.Rating.HasValue) await MovieRatingRecalculator.RecalculateAsync(_context, movie, ct);

        return entry.Id;
    }
}

// ---------- Günlük kaydını düzenle: tarih ve/veya puan ----------
public record UpdateScreeningLogEntryCommand(Guid UserId, Guid EntryId, DateTime WatchedAtUtc, decimal? Rating) : IRequest;

public class UpdateScreeningLogEntryCommandHandler : IRequestHandler<UpdateScreeningLogEntryCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateScreeningLogEntryCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateScreeningLogEntryCommand request, CancellationToken ct)
    {
        var entry = await _context.WatchHistory.Include(w => w.Movie)
            .FirstOrDefaultAsync(w => w.Id == request.EntryId && w.UserId == request.UserId, ct)
            ?? throw new NotFoundException(nameof(WatchHistory), request.EntryId);

        entry.WatchedAtUtc = request.WatchedAtUtc;
        entry.Rating = request.Rating;
        entry.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        await MovieRatingRecalculator.RecalculateAsync(_context, entry.Movie, ct);
    }
}

// ---------- Günlükten sil: silinen kayıt en son puanlıysa ortalamayı yeniden hesaplar ----------
public record DeleteScreeningLogEntryCommand(Guid UserId, Guid EntryId) : IRequest;

public class DeleteScreeningLogEntryCommandHandler : IRequestHandler<DeleteScreeningLogEntryCommand>
{
    private readonly IApplicationDbContext _context;
    public DeleteScreeningLogEntryCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(DeleteScreeningLogEntryCommand request, CancellationToken ct)
    {
        var entry = await _context.WatchHistory.Include(w => w.Movie)
            .FirstOrDefaultAsync(w => w.Id == request.EntryId && w.UserId == request.UserId, ct)
            ?? throw new NotFoundException(nameof(WatchHistory), request.EntryId);

        var movie = entry.Movie;
        _context.WatchHistory.Remove(entry);
        await _context.SaveChangesAsync(ct);

        await MovieRatingRecalculator.RecalculateAsync(_context, movie, ct);
    }
}