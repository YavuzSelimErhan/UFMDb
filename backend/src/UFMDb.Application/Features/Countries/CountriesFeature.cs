using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Application.DTOs;
namespace UFMDb.Application.Features.Countries;

public record GetCountriesQuery : IRequest<List<CountryDto>>;

public class GetCountriesQueryHandler : IRequestHandler<GetCountriesQuery, List<CountryDto>>
{
    private readonly IApplicationDbContext _context;
    public GetCountriesQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<List<CountryDto>> Handle(GetCountriesQuery request, CancellationToken ct)
    {
        var countries = await _context.Countries.AsNoTracking()
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        var counts = await _context.Movies.AsNoTracking()
            .Where(m => !m.IsDeleted && m.Country != "")
            .GroupBy(m => m.Country)
            .Select(g => new { Country = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return countries.Select(c => new CountryDto(
            c.Id, c.Name, c.NameTr,
            counts.FirstOrDefault(x => x.Country == c.Name)?.Count ?? 0
        )).ToList();
    }
}

public record CountryDto(Guid Id, string Name, string NameTr, int MovieCount);