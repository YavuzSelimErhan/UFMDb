using System.Reflection;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using UFMDb.Application.Common.Behaviors;

namespace UFMDb.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(assembly));
        services.AddValidatorsFromAssembly(assembly);

        // Pipeline sırası önemlidir: önce loglama, sonra validasyon
        services.AddTransient(typeof(MediatR.Pipeline.IRequestPreProcessor<>), typeof(RequestLoggingPreProcessor<>));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));

        return services;
    }
}

/// <summary>Basit pre-processor placeholder; genişletilebilirlik için hazır.</summary>
public class RequestLoggingPreProcessor<TRequest> : MediatR.Pipeline.IRequestPreProcessor<TRequest> where TRequest : notnull
{
    public Task Process(TRequest request, CancellationToken cancellationToken) => Task.CompletedTask;
}
