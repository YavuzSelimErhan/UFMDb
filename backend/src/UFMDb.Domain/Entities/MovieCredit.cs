namespace UFMDb.Domain.Entities;

public enum CreditKind { Cast, Crew }

public class MovieCredit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MovieId { get; set; }
    public Guid PersonId { get; set; }
    public CreditKind Kind { get; set; }
    public string Department { get; set; } = string.Empty;
    public string Job { get; set; } = string.Empty;
    public string? CharacterName { get; set; }
    public int Order { get; set; }
    public string? TmdbCreditId { get; set; }
}
