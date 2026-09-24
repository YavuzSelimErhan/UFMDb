using Microsoft.EntityFrameworkCore;
using UFMDb.Persistence;

namespace UFMDb.Tests.TestHelpers;

/// <summary>
/// Her çağrı, adı Guid'den türetilmiş izole bir InMemory veritabanı döner.
/// Böylece testler birbirinin verisini görmez ve paralel çalışabilir.
/// </summary>
public static class TestDbContextFactory
{
    public static ApplicationDbContext Create()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}
