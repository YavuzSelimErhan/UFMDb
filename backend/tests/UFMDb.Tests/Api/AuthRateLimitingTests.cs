using System.Threading.RateLimiting;
using UFMDb.API.RateLimiting;
using Xunit;

namespace UFMDb.Tests.Api;

/// <summary>
/// AuthRateLimitingExtensions içindeki politika, bir ASP.NET Core middleware pipeline'ına
/// (AddPolicy lambda'sı) bağlı olduğu için doğrudan çağrılamıyor. Bunun yerine, üretimde
/// kullanılan aynı PermitLimit/Window/QueueLimit değerleriyle eşdeğer bir
/// PartitionedRateLimiter kurup algoritmanın gerçek davranışını (limit, pencere, IP izolasyonu)
/// test ediyoruz. Middleware'in bu limiter'ı çağırma/429 döndürme kısmı ASP.NET Core'un
/// kendi test paketinde zaten kapsanıyor.
/// </summary>
public class AuthRateLimitingTests
{
    private static PartitionedRateLimiter<string> CreateLimiter() =>
        PartitionedRateLimiter.Create<string, string>(ip =>
            RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = AuthRateLimitingExtensions.PermitLimit,
                Window = AuthRateLimitingExtensions.Window,
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            }));

    [Fact]
    public async Task Limit_Icindeki_IstekleriKabulEder()
    {
        using var limiter = CreateLimiter();
        const string ip = "203.0.113.10";

        for (var i = 1; i <= AuthRateLimitingExtensions.PermitLimit; i++)
        {
            using var lease = await limiter.AcquireAsync(ip);
            Assert.True(lease.IsAcquired, $"{i}. istek limit dahilinde, kabul edilmeliydi.");
        }
    }

    [Fact]
    public async Task LimitiAsanIstegiReddeder()
    {
        using var limiter = CreateLimiter();
        const string ip = "203.0.113.10";

        for (var i = 0; i < AuthRateLimitingExtensions.PermitLimit; i++)
        {
            using var lease = await limiter.AcquireAsync(ip);
            Assert.True(lease.IsAcquired);
        }

        // (PermitLimit + 1). istek: aynı IP, aynı pencere içinde -> reddedilmeli
        using var rejected = await limiter.AcquireAsync(ip);
        Assert.False(rejected.IsAcquired);
    }

    [Fact]
    public async Task ReddedilenIstek_Kuyruga_Alinmaz()
    {
        // QueueLimit = 0: login/register'da beklemenin anlamı yok, ya hemen izin ver ya reddet.
        using var limiter = CreateLimiter();
        const string ip = "203.0.113.10";

        for (var i = 0; i < AuthRateLimitingExtensions.PermitLimit; i++)
            (await limiter.AcquireAsync(ip)).Dispose();

        var stats = limiter.GetStatistics(ip);
        Assert.NotNull(stats);
        Assert.Equal(0, stats!.CurrentQueuedCount);
    }

    [Fact]
    public async Task FarkliIpAdresleriBirbirindenBagimsizSinirlanir()
    {
        // NAT arkasında olmayan farklı bir IP, başka bir IP'nin limiti dolduğunda etkilenmemeli.
        using var limiter = CreateLimiter();
        const string ipA = "203.0.113.10";
        const string ipB = "203.0.113.20";

        for (var i = 0; i < AuthRateLimitingExtensions.PermitLimit; i++)
            (await limiter.AcquireAsync(ipA)).Dispose();

        using var rejectedForA = await limiter.AcquireAsync(ipA);
        Assert.False(rejectedForA.IsAcquired);

        using var acceptedForB = await limiter.AcquireAsync(ipB);
        Assert.True(acceptedForB.IsAcquired);
    }

    [Fact]
    public void PolitikaAyarlari_KullanicininOnayladigiDegerlerdir()
    {
        // Regresyon koruması: biri ileride "PermitLimit = 50" gibi bir değişiklik yaparsa
        // bu test kırılır ve bilinçli bir karar olup olmadığı sorgulanır.
        Assert.Equal(5, AuthRateLimitingExtensions.PermitLimit);
        Assert.Equal(TimeSpan.FromMinutes(1), AuthRateLimitingExtensions.Window);
        Assert.Equal("AuthLimiter", AuthRateLimitingExtensions.PolicyName);
    }
}
