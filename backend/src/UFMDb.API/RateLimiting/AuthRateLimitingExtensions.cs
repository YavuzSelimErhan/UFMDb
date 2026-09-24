using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace UFMDb.API.RateLimiting;

/// <summary>
/// Login/register brute-force koruması için IP bazlı fixed window rate limiting.
/// Ayrı bir sınıfa çıkarılmasının sebebi: PermitLimit/Window değerlerinin
/// UFMDb.Tests projesinden de referans alınabilmesi (bkz. AuthRateLimitingTests)
/// ve Program.cs'in sade kalması.
/// </summary>
public static class AuthRateLimitingExtensions
{
    public const string PolicyName = "AuthLimiter";
    public const int PermitLimit = 5;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public static IServiceCollection AddAuthRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.AddPolicy(PolicyName, httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = PermitLimit,
                        Window = Window,
                        QueueLimit = 0, // login/register'da bekletmenin anlamı yok: ya hemen izin ver ya reddet
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                    }));

            // ExceptionHandlingMiddleware ile aynı {status, title, errors} gövde şekli
            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.ContentType = "application/json";

                var payload = JsonSerializer.Serialize(new
                {
                    status = StatusCodes.Status429TooManyRequests,
                    title = "Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin.",
                    errors = (object?)null
                });

                await context.HttpContext.Response.WriteAsync(payload, cancellationToken);
            };
        });

        return services;
    }
}
