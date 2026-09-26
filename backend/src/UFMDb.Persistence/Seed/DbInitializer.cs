using Microsoft.EntityFrameworkCore;

namespace UFMDb.Persistence.Seed;

/// <summary>
/// Uygulama başlangıcında bekleyen migration'ları uygular.
/// Demo veri seed'i kasıtlı olarak kaldırıldı — gerçek veri UFMDb.Tools.TmdbImporter ile içe aktarılır.
/// </summary>
public static class DbInitializer
{
    public static async Task MigrateAsync(ApplicationDbContext context)
    {
        await context.Database.MigrateAsync();
    }
}
