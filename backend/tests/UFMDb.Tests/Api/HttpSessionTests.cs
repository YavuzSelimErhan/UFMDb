using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using UFMDb.API.Controllers;
using UFMDb.Tests.TestHelpers;
using Xunit;

namespace UFMDb.Tests.Api;

public class HttpSessionTests
{
    [PostgresFact]
    public async Task Registration_IssuesSession_ProfileAcceptsBearer_AndRefreshCookieRotates()
    {
        await using var db = PostgresDatabase.CreateContext();
        try
        {
            // Program runs the application's migrations against this new database at startup.
            using var factory = new WebApplicationFactory<AuthController>().WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:DefaultConnection", db.Database.GetConnectionString());
                builder.UseSetting("JwtSettings:Secret", Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
                builder.UseSetting("JwtSettings:Issuer", "ufmdb-tests");
                builder.UseSetting("JwtSettings:Audience", "ufmdb-test-client");
            });
            using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost"),
                HandleCookies = false,
                AllowAutoRedirect = false
            });
            const string counts = "/api/profile/watched-films/counts";
            using var anonymous = await client.GetAsync(counts);
            Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);

            using var registration = await client.PostAsJsonAsync("/api/auth/register", new
            { userName = "viewer", email = "viewer@example.test", password = "TestPass123" });
            Assert.Equal(HttpStatusCode.OK, registration.StatusCode);
            var body = await registration.Content.ReadFromJsonAsync<JsonElement>();
            Assert.False(body.TryGetProperty("refreshToken", out _));
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", body.GetProperty("accessToken").GetString());
            using var profile = await client.GetAsync(counts);
            Assert.Equal(HttpStatusCode.OK, profile.StatusCode);
            Assert.Equal(0, (await profile.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("all").GetInt32());

            using var adminUsers = await client.GetAsync("/api/users");
            Assert.Equal(HttpStatusCode.Forbidden, adminUsers.StatusCode);

            var cookie = ReadRefreshCookie(registration);
            client.DefaultRequestHeaders.Authorization = null;
            client.DefaultRequestHeaders.Add("Cookie", $"ufmdb_refresh={cookie}");
            using var refresh = await client.PostAsync("/api/auth/refresh", null);
            Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
            var rotated = ReadRefreshCookie(refresh);
            Assert.NotEqual(cookie, rotated);
            using var stale = await client.PostAsync("/api/auth/refresh", null);
            Assert.Equal(HttpStatusCode.Unauthorized, stale.StatusCode);
            client.DefaultRequestHeaders.Remove("Cookie");
            client.DefaultRequestHeaders.Add("Cookie", $"ufmdb_refresh={rotated}");
            using var logout = await client.PostAsync("/api/auth/logout", null);
            Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
            using var afterLogout = await client.PostAsync("/api/auth/refresh", null);
            Assert.Equal(HttpStatusCode.Unauthorized, afterLogout.StatusCode);
        }
        finally { await db.Database.EnsureDeletedAsync(); }
    }

    private static string ReadRefreshCookie(HttpResponseMessage response)
    {
        var cookie = SetCookieHeaderValue.Parse(Assert.Single(response.Headers.GetValues("Set-Cookie")));
        Assert.Equal("ufmdb_refresh", cookie.Name.Value);
        Assert.True(cookie.HttpOnly);
        Assert.True(cookie.Secure);
        Assert.Equal(Microsoft.Net.Http.Headers.SameSiteMode.None, cookie.SameSite);
        return cookie.Value.ToString();
    }
}
