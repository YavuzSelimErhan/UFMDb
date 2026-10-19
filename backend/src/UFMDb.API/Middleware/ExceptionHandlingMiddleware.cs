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
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // İstemci bağlantıyı kesti: hata değil, loglamaya gerek yok.
            if (!context.Response.HasStarted)
                context.Response.StatusCode = 499;
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private static (HttpStatusCode Status, string Title, object? Errors) Map(Exception exception)
    {
        return exception switch
        {
            NotFoundException => (HttpStatusCode.NotFound, exception.Message, null),
            ValidationException vex => (HttpStatusCode.BadRequest, "Doğrulama hatası", vex.Errors),
            UnauthorizedException => (HttpStatusCode.Unauthorized, exception.Message, null),
            ForbiddenException => (HttpStatusCode.Forbidden, exception.Message, null),
            ConflictException => (HttpStatusCode.Conflict, exception.Message, null),
            // [RequestSizeLimit] aşımı ve bozuk multipart gövdesi: 500 değil, istemci hatası.
            BadHttpRequestException { StatusCode: StatusCodes.Status413PayloadTooLarge }
                => (HttpStatusCode.RequestEntityTooLarge, "Dosya çok büyük.", null),
            BadHttpRequestException => (HttpStatusCode.BadRequest, "Geçersiz istek.", null),
            _ => (HttpStatusCode.InternalServerError, "Beklenmeyen bir sunucu hatası oluştu.", null)
        };
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, title, errors) = Map(exception);

        if (statusCode == HttpStatusCode.InternalServerError)
            _logger.LogError(exception, "İşlenmemiş istisna: {Message}", exception.Message);
        else
            _logger.LogWarning("İşlenen istisna: {Message}", exception.Message);

        // Yanıt başladıysa status/header değiştirilemez.
        if (context.Response.HasStarted)
        {
            _logger.LogWarning("Yanıt başlamış olduğu için hata yanıtı yazılamadı.");
            return;
        }

        // Response.Clear() yok ve header'lara dokunmuyoruz: CORS header'ları korunmalı.
        context.Response.ContentType = "application/json";
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