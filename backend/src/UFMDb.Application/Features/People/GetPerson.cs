using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Features.People;

public record PersonFilm(Guid Id, string Title, string PosterUrl, int Year, DateTime ReleaseDate,
    double Popularity, string[] Roles);
public record PersonDetail(Guid Id, string FullName, string PhotoUrl, string Biography,
    Guid? ActorId, Guid? DirectorId, List<PersonFilm> Films);
public record GetPerson(Guid Id, string Lang) : IRequest<PersonDetail>;

public class GetPersonHandler(IApplicationDbContext db) : IRequestHandler<GetPerson, PersonDetail>
{
    public async Task<PersonDetail> Handle(GetPerson request, CancellationToken ct)
    {
        var person = await db.People.AsNoTracking().FirstOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Person), request.Id);
        var tr = Localization.IsTurkish(request.Lang);
        var credits = await (from c in db.MovieCredits.AsNoTracking()
                             join m in db.Movies on c.MovieId equals m.Id
                             where c.PersonId == request.Id && !m.IsDeleted
                             select new { m.Id, Title = tr && m.TitleTr != "" ? m.TitleTr : m.Title,
                                 m.PosterUrl, m.ReleaseYear, m.ReleaseDate, m.TmdbPopularity,
                                 Role = c.Kind == CreditKind.Cast ? "Cast" : c.Job })
            .Distinct().ToListAsync(ct);
        var films = credits.GroupBy(c => c.Id).Select(group =>
        {
            var movie = group.First();
            return new PersonFilm(movie.Id, movie.Title, movie.PosterUrl, movie.ReleaseYear,
                movie.ReleaseDate, movie.TmdbPopularity, group.Select(c => c.Role).Order().ToArray());
        }).OrderByDescending(f => f.Popularity).ThenByDescending(f => f.ReleaseDate).ThenBy(f => f.Id).ToList();
        return new(person.Id, person.FullName, person.PhotoUrl, person.Biography,
            person.LegacyActorId, person.LegacyDirectorId, films);
    }
}
