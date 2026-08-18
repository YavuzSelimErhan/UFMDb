using System.Net;
using System.Text.Json;
using UFMDb.Application.Common.Exceptions;
using ValidationException = UFMDb.Application.Common.Exceptions.ValidationException;

namespace UFMDb.API.Middleware;

/// <summary>Tüm API genelinde tek noktadan hata yönetimi ve loglama sağlar.</summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, title, errors) = exception switch
        {
            NotFoundException => (HttpStatusCode.NotFound, exception.Message, null),
            ValidationException vex => (HttpStatusCode.BadRequest, "Doğrulama hatası", (object?)vex.Errors),
            UnauthorizedException => (HttpStatusCode.Unauthorized, exception.Message, null),
            ConflictException => (HttpStatusCode.Conflict, exception.Message, null),
            _ => (HttpStatusCode.InternalServerError, "Beklenmeyen bir sunucu hatası oluştu.", null)
        };

        if (statusCode == HttpStatusCode.InternalServerError)
            _logger.LogError(exception, "İşlenmemiş istisna: {Message}", exception.Message);
        else
            _logger.LogWarning("İşlenen istisna: {Message}", exception.Message);

        context.Response.StatusCode = (int)statusCode;

        var payload = JsonSerializer.Serialize(new
        {
            status = (int)statusCode,
            title,
            errors
        });

        await context.Response.WriteAsync(payload);
    }
}

public static class ExceptionHandlingMiddlewareExtensions
{
    public static IApplicationBuilder UseGlobalExceptionHandling(this IApplicationBuilder builder)
        => builder.UseMiddleware<ExceptionHandlingMiddleware>();
}
