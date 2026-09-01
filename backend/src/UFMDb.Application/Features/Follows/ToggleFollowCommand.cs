using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;
namespace UFMDb.Application.Features.Follows;

public record ToggleFollowCommand(Guid CurrentUserId, Guid TargetUserId) : IRequest<bool>;

public class ToggleFollowCommandValidator : AbstractValidator<ToggleFollowCommand>
{
    public ToggleFollowCommandValidator()
    {
        RuleFor(x => x).Must(x => x.CurrentUserId != x.TargetUserId)
            .WithMessage("Kendi kendini takip edemezsin.");
    }
}

public class ToggleFollowCommandHandler : IRequestHandler<ToggleFollowCommand, bool>
{
    private readonly IApplicationDbContext _context;
    public ToggleFollowCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<bool> Handle(ToggleFollowCommand request, CancellationToken ct)
    {
        var targetExists = await _context.Users.AsNoTracking()
            .AnyAsync(u => u.Id == request.TargetUserId && u.IsActive, ct);
        if (!targetExists)
            throw new NotFoundException(nameof(User), request.TargetUserId);

        var existing = await _context.Follows
            .FirstOrDefaultAsync(f =>
                f.FollowerId == request.CurrentUserId &&
                f.FollowingId == request.TargetUserId, ct);

        if (existing is not null)
        {
            _context.Follows.Remove(existing);
            await _context.SaveChangesAsync(ct);
            return false;
        }

        _context.Follows.Add(new Follow
        {
            FollowerId = request.CurrentUserId,
            FollowingId = request.TargetUserId,
        });
        await _context.SaveChangesAsync(ct);
        return true;
    }
}