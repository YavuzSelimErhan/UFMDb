using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using UFMDb.API.Middleware;
using UFMDb.Application.Common.Exceptions;
using Xunit;
using ValidationException = UFMDb.Application.Common.Exceptions.ValidationException;

namespace UFMDb.Tests.Api;

public class ExceptionHandlingMiddlewareTests
{
    private static async Task<(int StatusCode, JsonElement Body)> InvokeAsync(Exception exceptionToThrow)
    {
        var middleware = new ExceptionHandlingMiddleware(_ => throw exceptionToThrow, NullLogger<ExceptionHandlingMiddleware>.Instance);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var json = await reader.ReadToEndAsync();

        return (context.Response.StatusCode, JsonDocument.Parse(json).RootElement.Clone());
    }

    [Fact]
    public async Task NotFoundException_404DonerVeMesajTasir()
    {
        var (status, body) = await InvokeAsync(new NotFoundException("Film", Guid.NewGuid()));

        Assert.Equal((int)HttpStatusCode.NotFound, status);
        Assert.Equal((int)HttpStatusCode.NotFound, body.GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task UnauthorizedException_401Doner()
    {
        var (status, _) = await InvokeAsync(new UnauthorizedException("E-posta veya şifre hatalı."));

        Assert.Equal((int)HttpStatusCode.Unauthorized, status);
    }

    [Fact]
    public async Task ConflictException_409Doner()
    {
        var (status, _) = await InvokeAsync(new ConflictException("Bu e-posta adresi zaten kayıtlı."));

        Assert.Equal((int)HttpStatusCode.Conflict, status);
    }

    [Fact]
    public async Task ValidationException_400DonerVeErrorsAlaniniTasir()
    {
        var errors = new Dictionary<string, string[]> { ["Email"] = new[] { "Geçersiz e-posta." } };

        var (status, body) = await InvokeAsync(new ValidationException(errors));

        Assert.Equal((int)HttpStatusCode.BadRequest, status);
        Assert.True(body.GetProperty("errors").TryGetProperty("Email", out _));
    }

    [Fact]
    public async Task BilinmeyenHata_500DonerVeIcDetayiSizdirmaz()
    {
        // Güvenlik: beklenmeyen istisnaların (örn. DB bağlantı hatası) iç detayları
        // response body'sine yansımamalı, sadece genel bir mesaj dönülmeli.
        var (status, body) = await InvokeAsync(new InvalidOperationException("connection string: Host=internal-db;Password=gizli"));

        Assert.Equal((int)HttpStatusCode.InternalServerError, status);
        var title = body.GetProperty("title").GetString();
        Assert.DoesNotContain("gizli", title);
        Assert.DoesNotContain("internal-db", title);
    }
}
