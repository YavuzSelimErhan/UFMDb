namespace UFMDb.Domain.Entities;

public enum CreditKind { Cast, Crew }

public class MovieCredit
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;

    public Guid PersonId { get; set; }
    public Person Person { get; set; } = default!;

    public CreditKind Kind { get; set; }

    /// <summary>TMDB department (örn. "Directing", "Acting"). Cast için "Acting".</summary>
    public string Department { get; set; } = string.Empty;

    /// <summary>Crew için görev (örn. "Director", "Writer"). Cast için boş.</summary>
    public string Job { get; set; } = string.Empty;

    /// <summary>Sadece Cast için: canlandırılan karakter.</summary>
    public string? CharacterName { get; set; }

    /// <summary>Kredi sırası (afişteki oyuncu sırası vb.)</summary>
    public int Order { get; set; }

    /// <summary>TMDB credit_id. Sync sırasında upsert anahtarı.</summary>
    public string? TmdbCreditId { get; set; }
}