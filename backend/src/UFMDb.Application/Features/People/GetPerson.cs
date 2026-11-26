using System.Linq.Expressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
using UFMDb.Domain.Entities;
using ReactionType = UFMDb.Domain.Enums.ReactionType;

namespace UFMDb.Application.Features.People;

// ---------- DTO'lar ----------
public record PersonListItemDto(Guid Id, string FullName, string PhotoUrl, string Nationality);

/// <summary>Kiþi arama/liste kartý: beðeni durumu ve seçili roldeki film sayýsýyla birlikte.</summary>
public record PersonSearchItemDto(
    Guid Id, string FullName, string PhotoUrl, string Nationality,
    int LikeCount, bool IsLikedByCurrentUser,
    int FilmCount, string? PrimaryRole);

public record PersonFilm(MovieListItemDto Movie, double Popularity, string[] Roles);

public record PersonDetail(
    Guid Id, string FullName, DateTime? BirthDate, string Biography, string PhotoUrl, string Nationality,
    int LikeCount, bool IsLikedByCurrentUser,
    Guid? ActorId, Guid? DirectorId, List<PersonFilm> Films);

// ---------- Roller ----------
/// <summary>Arama filtresindeki roller ile MovieCredit (Kind + Job) eþlemesi.</summary>
public static class PersonRoles
{
    public const string Actor = "actor";
    public const string Director = "director";

    // TMDB "Job" deðerleri; yeni bir görev eþlemek için sadece buraya ekle.
    private static readonly Dictionary<string, string[]> CrewJobs = new()
    {
        ["writer"] = ["Writer", "Screenplay", "Story", "Novel"],
        ["composer"] = ["Original Music Composer", "Composer", "Music"],
        ["cinematographer"] = ["Director of Photography"],
        ["editor"] = ["Editor"],
        ["producer"] = ["Producer"],
    };

    public static readonly string[] All =
        [Actor, Director, "writer", "composer", "cinematographer", "editor", "producer"];

    public static string? Normalize(string? role)
    {
        var r = role?.Trim().ToLowerInvariant();
        return r is not null && All.Contains(r) ? r : null;
    }

    public static Expression<Func<MovieCredit, bool>> Predicate(string role)
    {
        if (role == Actor) return c => c.Kind == CreditKind.Cast;
        if (role == Director) return c => c.Kind == CreditKind.Crew && c.Job == "Director";
        var jobs = CrewJobs[role];
        return c => c.Kind == CreditKind.Crew && jobs.Contains(c.Job);
    }

    /// <summary>Rol seçilmediðinde sýralama için sayýlan krediler: oyunculuk + yönetmenlik.</summary>
    public static readonly Expression<Func<MovieCredit, bool>> ActingOrDirecting =
        c => c.Kind == CreditKind.Cast || (c.Kind == CreditKind.Crew && c.Job == "Director");

    public static string? RoleOf(CreditKind kind, string job)
    {
        if (kind == CreditKind.Cast) return Actor;
        if (job == "Director") return Director;
        foreach (var (role, jobs) in CrewJobs)
            if (jobs.Contains(job)) return role;
        return null;
    }
}

// ---------- Liste / arama ----------
/// <summary>
/// Role: actor | director | writer | composer | cinematographer | editor | producer (boþsa tüm kiþiler).
/// Sort: popular (seçili roldeki film sayýsý, varsayýlan) | likes | name.
/// </summary>
public record GetPeople(
    string? Search, string? Role, int Page = 1, int PageSize = 20,
    string? Sort = null, Guid? CurrentUserId = null) : IRequest<PagedResult<PersonSearchItemDto>>;

public class GetPeopleHandler(IApplicationDbContext db) : IRequestHandler<GetPeople, PagedResult<PersonSearchItemDto>>
{
    public async Task<PagedResult<PersonSearchItemDto>> Handle(GetPeople request, CancellationToken ct)
    {
        var role = PersonRoles.Normalize(request.Role);
        // Hem filtre hem sýralama SADECE seçilen role ait kredilere göre yapýlýr.
        var credits = db.MovieCredits.AsNoTracking()
            .Where(role is null ? PersonRoles.ActingOrDirecting : PersonRoles.Predicate(role));

        var query = db.People.AsNoTracking().Where(p => !p.IsDeleted);
        if (role is not null)
            query = query.Where(p => credits.Any(c => c.PersonId == p.Id));

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var pattern = $"%{SqlLike.Escape(request.Search.Trim())}%";
            query = query.Where(p => EF.Functions.ILike(
                EF.Functions.Unaccent(p.FullName), EF.Functions.Unaccent(pattern), SqlLike.EscapeCharacter));
        }

        var total = await query.CountAsync(ct);
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize is < 1 or > 100 ? 20 : request.PageSize;

        var ranked = query.Select(p => new
        {
            p.Id,
            p.FullName,
            p.PhotoUrl,
            p.Nationality,
            p.LikeCount,
            Films = credits.Where(c => c.PersonId == p.Id).Select(c => c.MovieId).Distinct().Count()
        });

        var sorted = request.Sort?.ToLowerInvariant() switch
        {
            "likes" => ranked.OrderByDescending(x => x.LikeCount).ThenByDescending(x => x.Films),
            "name" => ranked.OrderBy(x => x.FullName),
            _ => ranked.OrderByDescending(x => x.Films).ThenByDescending(x => x.LikeCount)
        };

        var rows = await sorted
            .ThenBy(x => x.FullName)
            .ThenBy(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);

        var ids = rows.Select(r => r.Id).ToList();

        // Sayfadaki kiþiler için: bu kullanýcýnýn beðenileri
        var likedIds = new HashSet<Guid>();
        if (request.CurrentUserId is Guid uid && ids.Count > 0)
        {
            likedIds = (await db.PersonLikes.AsNoTracking()
                    .Where(l => l.UserId == uid && ids.Contains(l.PersonId))
                    .Select(l => l.PersonId)
                    .ToListAsync(ct))
                .ToHashSet();
        }

        // Sayfadaki kiþiler için: rol baþýna (tekil) film sayýsý -> ana rol ve rozet
        var creditRows = ids.Count == 0
            ? []
            : await db.MovieCredits.AsNoTracking()
                .Where(c => ids.Contains(c.PersonId))
                .Select(c => new { c.PersonId, c.MovieId, c.Kind, c.Job })
                .Distinct()
                .ToListAsync(ct);

        var filmsByRole = creditRows
            .GroupBy(r => r.PersonId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(r => (Role: PersonRoles.RoleOf(r.Kind, r.Job), r.MovieId))
                      .Where(x => x.Role is not null)
                      .GroupBy(x => x.Role!)
                      .ToDictionary(rg => rg.Key, rg => rg.Select(x => x.MovieId).Distinct().Count()));

        var items = rows.Select(r =>
        {
            var counts = filmsByRole.GetValueOrDefault(r.Id) ?? new Dictionary<string, int>();
            var primary = role ?? counts.OrderByDescending(kv => kv.Value).Select(kv => kv.Key).FirstOrDefault();
            var films = primary is not null && counts.TryGetValue(primary, out var n) ? n : r.Films;
            return new PersonSearchItemDto(
                r.Id, r.FullName, r.PhotoUrl, r.Nationality,
                r.LikeCount, likedIds.Contains(r.Id), films, primary);
        }).ToList();

        return new PagedResult<PersonSearchItemDto>(items, total, page, pageSize);
    }
}

// ---------- Detay ----------
public record GetPerson(Guid Id, string Lang, Guid? CurrentUserId = null) : IRequest<PersonDetail>;

public class GetPersonHandler(IApplicationDbContext db) : IRequestHandler<GetPerson, PersonDetail>
{
    public async Task<PersonDetail> Handle(GetPerson request, CancellationToken ct)
    {
        var person = await db.People.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Person), request.Id);

        // 1) Film baþýna roller
        var credits = await (from c in db.MovieCredits.AsNoTracking()
                             join m in db.Movies on c.MovieId equals m.Id
                             where c.PersonId == request.Id && !m.IsDeleted
                             select new
                             {
                                 c.MovieId,
                                 Role = c.Kind == CreditKind.Cast ? "Cast" : (c.Job == "" ? "Crew" : c.Job)
                             })
            .Distinct().ToListAsync(ct);

        var rolesByMovie = credits.GroupBy(c => c.MovieId)
            .ToDictionary(g => g.Key, g => g.Select(c => c.Role).Order().ToArray());
        var movieIds = rolesByMovie.Keys.ToList();

        // 2) Filmler (liste projeksiyonuyla; Türkçe baþlýk/özet/tür dahil)
        var tr = Localization.IsTurkish(request.Lang);
        var baseQuery = db.Movies.AsNoTracking().Where(m => movieIds.Contains(m.Id) && !m.IsDeleted);

        var dtos = await baseQuery.Select(MovieProjections.ListItem(tr)).ToListAsync(ct);
        var popularityById = await baseQuery
            .Select(m => new { m.Id, m.TmdbPopularity })
            .ToDictionaryAsync(x => x.Id, x => x.TmdbPopularity, ct);

        // 3) Kullanýcý bayraklarý (tek yerden)
        var uid = request.CurrentUserId;
        if (uid is Guid userId && dtos.Count > 0)
            dtos = await MovieUserFlags.ApplyAsync(db, dtos, userId, ct);

        var films = dtos
            .Select(d => new PersonFilm(d, popularityById[d.Id], rolesByMovie[d.Id]))
            .OrderByDescending(f => f.Popularity)
            .ThenByDescending(f => f.Movie.ReleaseDate)
            .ThenBy(f => f.Movie.Id)
            .ToList();

        // 4) Kiþi beðenisi
        var isLiked = uid is Guid lu &&
            await db.PersonLikes.AsNoTracking().AnyAsync(l => l.PersonId == person.Id && l.UserId == lu, ct);

        return new PersonDetail(
            person.Id, person.FullName, person.BirthDate, person.Biography, person.PhotoUrl, person.Nationality,
            person.LikeCount, isLiked,
            person.LegacyActorId, person.LegacyDirectorId, films);
    }
}

// ---------- Beðen / beðenmekten vazgeç (toggle) ----------
public record TogglePersonLike(Guid PersonId, Guid UserId) : IRequest<bool>;

public class TogglePersonLikeHandler(IApplicationDbContext db) : IRequestHandler<TogglePersonLike, bool>
{
    public async Task<bool> Handle(TogglePersonLike request, CancellationToken ct)
    {
        // Soft-delete query filter silinmiþ kiþiyi zaten dýþarýda býrakýr
        var person = await db.People.FirstOrDefaultAsync(p => p.Id == request.PersonId, ct)
            ?? throw new NotFoundException(nameof(Person), request.PersonId);

        var existing = await db.PersonLikes
            .FirstOrDefaultAsync(l => l.PersonId == request.PersonId && l.UserId == request.UserId, ct);

        bool nowLiked;
        try
        {
            if (existing is null)
            {
                db.PersonLikes.Add(new PersonLike { PersonId = request.PersonId, UserId = request.UserId });
                nowLiked = true;
            }
            else
            {
                db.PersonLikes.Remove(existing);
                nowLiked = false;
            }
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        {
            // Eþzamanlý baþka bir istek ayný beðeniyi zaten ekledi
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            // Eþzamanlý baþka bir istek beðeniyi zaten kaldýrdý
            return false;
        }

        // Sayaç, artýr/azalt yerine gerçek satýr sayýsýndan hesaplanýr: eþzamanlý isteklerde
        // sayý kayýyorsa bir sonraki iþlemde kendini düzeltir.
        person.LikeCount = await db.PersonLikes.CountAsync(l => l.PersonId == request.PersonId, ct);
        await db.SaveChangesAsync(ct);
        return nowLiked;
    }
}

// ---------- Eski Actor/Director id'sinden PersonId bul (eski linkler için) ----------
/// <summary>Kind: "actor" veya "director".</summary>
public record ResolveLegacyPerson(string Kind, Guid LegacyId) : IRequest<Guid>;

public class ResolveLegacyPersonHandler(IApplicationDbContext db) : IRequestHandler<ResolveLegacyPerson, Guid>
{
    public async Task<Guid> Handle(ResolveLegacyPerson request, CancellationToken ct)
    {
        var query = db.People.AsNoTracking().Where(p => !p.IsDeleted);
        query = request.Kind.ToLowerInvariant() switch
        {
            "actor" => query.Where(p => p.LegacyActorId == request.LegacyId),
            "director" => query.Where(p => p.LegacyDirectorId == request.LegacyId),
            _ => throw new NotFoundException(nameof(Person), request.LegacyId)
        };

        var id = await query.Select(p => (Guid?)p.Id).FirstOrDefaultAsync(ct);
        return id ?? throw new NotFoundException(nameof(Person), request.LegacyId);
    }
}