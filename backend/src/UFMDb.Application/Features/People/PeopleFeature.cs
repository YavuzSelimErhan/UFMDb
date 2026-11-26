using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;

namespace UFMDb.Application.Features.People;

internal static class PersonRules
{
    public static DateTime? ToUtc(DateTime? d) => d is null ? null : d.Value.Kind switch
    {
        DateTimeKind.Utc => d.Value,
        DateTimeKind.Local => d.Value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(d.Value, DateTimeKind.Utc)
    };

    public static void Apply<T>(AbstractValidator<T> v,
        System.Linq.Expressions.Expression<Func<T, string>> fullName,
        System.Linq.Expressions.Expression<Func<T, string>> biography,
        System.Linq.Expressions.Expression<Func<T, string>> photoUrl,
        System.Linq.Expressions.Expression<Func<T, string>> nationality)
    {
        v.RuleFor(fullName).NotEmpty().MaximumLength(200);
        v.RuleFor(biography).MaximumLength(4000);
        v.RuleFor(photoUrl).MaximumLength(500);
        v.RuleFor(nationality).MaximumLength(100);
    }
}

// ---------- Admin: Kişi ekle ----------
public record CreatePerson(string FullName, DateTime? BirthDate, string Biography, string PhotoUrl, string Nationality) : IRequest<Guid>;

public class CreatePersonValidator : AbstractValidator<CreatePerson>
{
    public CreatePersonValidator() =>
        PersonRules.Apply(this, x => x.FullName, x => x.Biography, x => x.PhotoUrl, x => x.Nationality);
}

public class CreatePersonHandler(IApplicationDbContext db) : IRequestHandler<CreatePerson, Guid>
{
    public async Task<Guid> Handle(CreatePerson request, CancellationToken ct)
    {
        var person = new Person
        {
            FullName = request.FullName,
            BirthDate = PersonRules.ToUtc(request.BirthDate),
            Biography = request.Biography,
            PhotoUrl = request.PhotoUrl,
            Nationality = request.Nationality
        };
        db.People.Add(person);
        await db.SaveChangesAsync(ct);
        return person.Id;
    }
}

// ---------- Admin: Kişi güncelle ----------
public record UpdatePerson(Guid Id, string FullName, DateTime? BirthDate, string Biography, string PhotoUrl, string Nationality) : IRequest;

public class UpdatePersonValidator : AbstractValidator<UpdatePerson>
{
    public UpdatePersonValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        PersonRules.Apply(this, x => x.FullName, x => x.Biography, x => x.PhotoUrl, x => x.Nationality);
    }
}

public class UpdatePersonHandler(IApplicationDbContext db) : IRequestHandler<UpdatePerson>
{
    public async Task Handle(UpdatePerson request, CancellationToken ct)
    {
        var person = await db.People.FirstOrDefaultAsync(p => p.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(Person), request.Id);

        person.FullName = request.FullName;
        person.BirthDate = PersonRules.ToUtc(request.BirthDate);
        person.Biography = request.Biography;
        person.PhotoUrl = request.PhotoUrl;
        person.Nationality = request.Nationality;
        person.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
    }
}

// ---------- Admin: Kişi sil (soft delete) ----------
public record DeletePerson(Guid Id) : IRequest;

public class DeletePersonHandler(IApplicationDbContext db) : IRequestHandler<DeletePerson>
{
    public async Task Handle(DeletePerson request, CancellationToken ct)
    {
        var person = await db.People.FirstOrDefaultAsync(p => p.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(Person), request.Id);
        person.IsDeleted = true;
        person.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}