using UFMDb.Domain.Common;

namespace UFMDb.Domain.Entities;

public class Person : BaseEntity
{
    public int? TmdbId { get; set; }
    public Guid? LegacyActorId { get; set; }
    public Guid? LegacyDirectorId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public DateTime? BirthDate { get; set; }
    public string Biography { get; set; } = string.Empty;
    public string PhotoUrl { get; set; } = string.Empty;
    public string Nationality { get; set; } = string.Empty;
}
