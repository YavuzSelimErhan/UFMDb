using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using UFMDb.Application.Common.Exceptions;
using UFMDb.Application.Common.Interfaces;
using UFMDb.Domain.Entities;
using UFMDb.Domain.Enums;

namespace UFMDb.Application.Features.Users;

// ---------- Seans Defteri gizlilik ayarı ----------
public record UpdateDiaryVisibilityCommand(Guid UserId, DiaryVisibility Visibility) : IRequest;

public class UpdateDiaryVisibilityCommandValidator : AbstractValidator<UpdateDiaryVisibilityCommand>
{
    public UpdateDiaryVisibilityCommandValidator()
    {
        RuleFor(x => x.Visibility).IsInEnum().WithMessage("Geçersiz gizlilik değeri.");
    }
}

public class UpdateDiaryVisibilityCommandHandler : IRequestHandler<UpdateDiaryVisibilityCommand>
{
    private readonly IApplicationDbContext _context;
    public UpdateDiaryVisibilityCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task Handle(UpdateDiaryVisibilityCommand request, CancellationToken ct)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw new NotFoundException(nameof(User), request.UserId);

        user.DiaryVisibility = request.Visibility;
        user.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}