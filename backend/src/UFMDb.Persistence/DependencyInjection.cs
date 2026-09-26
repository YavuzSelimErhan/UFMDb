using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using UFMDb.Application.Common.Interfaces;

namespace UFMDb.Persistence;

public static class DependencyInjection
{
    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContextPool<ApplicationDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection"),
                b =>
                {
                    b.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);

                    // Geçici DB kesintilerinde (network blip, failover vb.) isteği
                    // hemen patlatmak yerine otomatik retry yapar.
                    b.EnableRetryOnFailure(
                        maxRetryCount: 3,
                        maxRetryDelay: TimeSpan.FromSeconds(5),
                        errorCodesToAdd: null);

                    // Include().ThenInclude() zincirlerinin tek dev JOIN yerine
                    // ayrı sorgulara bölünmesini global default yapar; Actor/Director/Movie
                    // detay sorgularındaki cartesian explosion riskini ortadan kaldırır.
                    b.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                }));

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());

        return services;
    }
}