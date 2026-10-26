using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Interfaces;

namespace UFMDb.Application.Features.Users;

/// <summary>Kullanıcının tüm watchlist'ini siler. Silinen kayıt sayısını döner.</summary>
public record ClearWatchlistCommand(Guid UserId) : IRequest<int>;

public class ClearWatchlistCommandHandler : IRequestHandler<ClearWatchlistCommand, int>
{
    private readonly IApplicationDbContext _context;
    public ClearWatchlistCommandHandler(IApplicationDbContext context) => _context = context;

    public Task<int> Handle(ClearWatchlistCommand request, CancellationToken ct) =>
        _context.WatchlistItems
            .Where(w => w.UserId == request.UserId)
            .ExecuteDeleteAsync(ct);
}