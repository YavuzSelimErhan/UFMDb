using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq;
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
    string? FullName, string? Country, DateTime? BirthDate, string Gender, string? Biography,
    List<FavoriteSlotDto> FavoriteMovies,
    List<RecentlyWatchedItemDto> RecentlyWatched,
    List<MovieListItemDto> LikedMovies,
    List<MovieListItemDto> Watchlist,
    List<ReviewSummaryDto> Reviews,
    List<FavoriteActorSlotDto> FavoriteActors,
    List<ActorListItemDto> LikedActors,
    List<FavoriteDirectorSlotDto> FavoriteDirectors,
    List<DirectorListItemDto> LikedDirectors,
    int TotalWatchedCount,
    decimal? AverageGivenRating,
    int RatingsCount,
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

        // Like/watchlist bayraklarını bu handler içindeki TÜM MovieListItemDto dönüşümlerinde
        // tutarlı kullanmak için, zaten çekmiş olduğumuz 'liked'/'watchlist' listelerinden
        // (ekstra sorguya gerek kalmadan) iki HashSet çıkarıyoruz.
        var likedMovieIds = liked.Select(l => l.MovieId).ToHashSet();
        var watchlistMovieIds = watchlist.Select(w => w.MovieId).ToHashSet();

        // Her zaman 4 sabit slot döndürülür (1-4); dolu olmayan slotlar Movie=null olarak gelir.
        var favorites = Enumerable.Range(1, 4)
            .Select(slot =>
            {
                var match = favoriteEntities.FirstOrDefault(f => f.Slot == slot);
                return new FavoriteSlotDto(slot, match is null ? null : ToListItem(match.Movie, likedMovieIds, watchlistMovieIds));
            })
            .ToList();

        var userRatings = await _context.MovieRatings.AsNoTracking()
            .Where(r => r.UserId == request.UserId)
            .ToListAsync(ct);

        var userRatingsLookup = userRatings.ToDictionary(r => r.MovieId, r => r.Value);
        var averageGivenRating = userRatings.Count > 0 ? Math.Round(userRatings.Average(r => r.Value), 2) : (decimal?)null;
        var ratingsCount = userRatings.Count;

        var recentlyWatched = recent.Select(w => new RecentlyWatchedItemDto(
            ToListItem(w.Movie, likedMovieIds, watchlistMovieIds), w.Rating
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
            user.FullName, user.Country, user.BirthDate, user.Gender.ToString(), user.Biography,
            favorites,
            recentlyWatched,
            liked.Select(l => ToListItem(l.Movie, likedMovieIds, watchlistMovieIds)).ToList(),
            watchlist.Select(w => ToListItem(w.Movie, likedMovieIds, watchlistMovieIds)).ToList(),
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

    private static MovieListItemDto ToListItem(Movie m, HashSet<Guid> likedIds, HashSet<Guid> watchlistIds) => new(
    m.Id, m.Title, m.ReleaseYear, m.PosterUrl, (decimal)m.AverageRating, m.RatingCount,
    m.MovieGenres.Select(g => g.Genre.Name).ToList(), m.BackdropUrl, m.Overview,
    watchlistIds.Contains(m.Id), likedIds.Contains(m.Id), m.ReleaseDate);
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
public record UpdateProfileCommand(
    Guid UserId, string UserName, string? AvatarUrl,
    string? FullName, string? Country, DateTime? BirthDate, string? Gender, string? Biography
) : IRequest;

public class UpdateProfileCommandValidator : AbstractValidator<UpdateProfileCommand>
{
    public UpdateProfileCommandValidator()
    {
        RuleFor(x => x.UserName).NotEmpty().MinimumLength(3).MaximumLength(50);
        RuleFor(x => x.AvatarUrl).MaximumLength(500);
        RuleFor(x => x.FullName).MaximumLength(100);
        RuleFor(x => x.Country).MaximumLength(100);
        RuleFor(x => x.Biography).MaximumLength(500);
        RuleFor(x => x.Gender)
            .Must(g => string.IsNullOrEmpty(g) || Enum.TryParse<UFMDb.Domain.Enums.Gender>(g, out _))
            .WithMessage("Geçersiz cinsiyet değeri.");
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
        user.FullName = string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName;
        user.Country = string.IsNullOrWhiteSpace(request.Country) ? null : request.Country;
        user.BirthDate = request.BirthDate;
        user.Biography = string.IsNullOrWhiteSpace(request.Biography) ? null : request.Biography;

        if (!string.IsNullOrWhiteSpace(request.Gender) && Enum.TryParse<UFMDb.Domain.Enums.Gender>(request.Gender, out var parsedGender))
            user.Gender = parsedGender;

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

public record WatchedMovieDto(Guid MovieId, MovieListItemDto Movie, DateTime WatchedAtUtc, decimal? UserRating);
public record GetUserWatchedMoviesQuery(Guid UserId, int Page, int PageSize, string? SortBy, bool? HasRating) : IRequest<PagedResult<WatchedMovieDto>>;

public class GetUserWatchedMoviesQueryHandler : IRequestHandler<GetUserWatchedMoviesQuery, PagedResult<WatchedMovieDto>>
{
    private readonly IApplicationDbContext _context;
    public GetUserWatchedMoviesQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<PagedResult<WatchedMovieDto>> Handle(GetUserWatchedMoviesQuery request, CancellationToken ct)
    {
        // Her film için en son izleme tarihi (varsa)
        var lastWatchedByMovie = await _context.WatchHistory.AsNoTracking()
            .Where(w => w.UserId == request.UserId)
            .GroupBy(w => w.MovieId)
            .Select(g => new { MovieId = g.Key, LastWatchedAtUtc = g.Max(w => w.WatchedAtUtc) })
            .ToDictionaryAsync(x => x.MovieId, x => x.LastWatchedAtUtc, ct);

        // Kullanıcının GÜNCEL puanları — artık asıl kaynak burası
        var ratingEntities = await _context.MovieRatings.AsNoTracking()
            .Where(r => r.UserId == request.UserId)
            .ToListAsync(ct);
        var ratingValueByMovie = ratingEntities.ToDictionary(r => r.MovieId, r => r.Value);
        var ratingDateByMovie = ratingEntities.ToDictionary(r => r.MovieId, r => r.CreatedAtUtc);

        // İki kümenin birleşimi: izlenmiş VEYA puanlanmış her film
        var movieIds = lastWatchedByMovie.Keys.Union(ratingValueByMovie.Keys).ToList();

        var movies = await _context.Movies.AsNoTracking()
            .Include(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
            .Where(m => movieIds.Contains(m.Id))
            .ToListAsync(ct);

        var likedMovieIds = await _context.Likes.AsNoTracking()
            .Where(l => l.UserId == request.UserId).Select(l => l.MovieId).ToListAsync(ct);
        var watchlistMovieIds = await _context.WatchlistItems.AsNoTracking()
            .Where(w => w.UserId == request.UserId).Select(w => w.MovieId).ToListAsync(ct);
        var likedSet = likedMovieIds.ToHashSet();
        var watchlistSet = watchlistMovieIds.ToHashSet();

        IEnumerable<WatchedMovieDto> all = movies.Select(m =>
        {
            var hasWatch = lastWatchedByMovie.TryGetValue(m.Id, out var lastWatched);
            // Tarih önceliği: gerçekten izlenmişse izleme tarihi, sadece puanlanmışsa puanın verildiği tarih
            var date = hasWatch ? lastWatched : ratingDateByMovie[m.Id];
            var rating = ratingValueByMovie.TryGetValue(m.Id, out var r) ? r : (decimal?)null;
            return new WatchedMovieDto(m.Id, ToListItem(m, likedSet, watchlistSet), date, rating);
        });

        if (request.HasRating is true) all = all.Where(w => w.UserRating.HasValue);
        if (request.HasRating is false) all = all.Where(w => !w.UserRating.HasValue);

        all = request.SortBy switch
        {
            "watched-asc" => all.OrderBy(w => w.WatchedAtUtc),
            "release-desc" => all.OrderByDescending(w => w.Movie.ReleaseDate),
            "release-asc" => all.OrderBy(w => w.Movie.ReleaseDate),
            "rating-desc" => all.OrderByDescending(w => w.UserRating ?? -1),
            "rating-asc" => all.OrderBy(w => w.UserRating ?? -1),
            "movie-rating-desc" => all.OrderByDescending(w => w.Movie.AverageRating),
            "movie-rating-asc" => all.OrderBy(w => w.Movie.AverageRating),
            "title-asc" => all.OrderBy(w => w.Movie.Title),
            _ => all.OrderByDescending(w => w.WatchedAtUtc)
        };

        var allSorted = all.ToList();
        var totalCount = allSorted.Count;
        var page = allSorted.Skip((request.Page - 1) * request.PageSize).Take(request.PageSize).ToList();

        return new PagedResult<WatchedMovieDto>(page, totalCount, request.Page, request.PageSize);
    }

    private static MovieListItemDto ToListItem(Movie m, HashSet<Guid> likedIds, HashSet<Guid> watchlistIds) => new(
        m.Id, m.Title, m.ReleaseYear, m.PosterUrl, (decimal)m.AverageRating, m.RatingCount,
        m.MovieGenres.Select(g => g.Genre.Name).ToList(), m.BackdropUrl, m.Overview,
        watchlistIds.Contains(m.Id), likedIds.Contains(m.Id), m.ReleaseDate);
}

public record RemoveWatchedMovieCommand(Guid UserId, Guid MovieId) : IRequest;

public class RemoveWatchedMovieCommandHandler : IRequestHandler<RemoveWatchedMovieCommand>
{
    private readonly IApplicationDbContext _context;
    public RemoveWatchedMovieCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(RemoveWatchedMovieCommand request, CancellationToken ct)
    {
        var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Id == request.MovieId, ct)
            ?? throw new NotFoundException(nameof(Movie), request.MovieId);

        var watchEntries = await _context.WatchHistory
            .Where(w => w.UserId == request.UserId && w.MovieId == request.MovieId)
            .ToListAsync(ct);
        _context.WatchHistory.RemoveRange(watchEntries);

        var rating = await _context.MovieRatings
            .FirstOrDefaultAsync(r => r.UserId == request.UserId && r.MovieId == request.MovieId, ct);
        if (rating is not null) _context.MovieRatings.Remove(rating);

        await _context.SaveChangesAsync(ct);
        await MovieRatingRecalculator.RecalculateAsync(_context, movie, ct);
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

        if (request.Rating.HasValue)
            await MovieRatingRecalculator.UpsertCurrentRatingAsync(_context, movie, request.UserId, request.Rating.Value, ct);

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

        if (request.Rating.HasValue)
            await MovieRatingRecalculator.UpsertCurrentRatingAsync(_context, entry.Movie, request.UserId, request.Rating.Value, ct);
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