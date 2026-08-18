using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;

namespace UFMDb.Persistence.Seed;

/// <summary>
/// İlk migration sonrası çalıştırılan seed sınıfı.
/// Not: Many-to-many ilişkiler (Movie-Genre, Movie-Actor) HasData yerine burada
/// imperative olarak seed edilir; bu, GUID ilişkilerini yönetmeyi kolaylaştırır
/// ve migration dosyasını daha okunabilir tutar.
/// </summary>
public static class DbInitializer
{
    public static async Task SeedAsync(ApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        await context.Database.MigrateAsync();

        if (await context.Movies.AnyAsync()) return; // zaten seed edilmiş
    }
}
