using UFMDb.Domain.Common;
namespace UFMDb.Domain.Entities;

/// <summary>
/// Kullanıcının bir filme dair GÜNCEL, tarihten bağımsız görüşü — "senin puanın".
/// Hem hızlı puanlama (quick-rate) hem de seans defteri kaydı (WatchHistory) puanlı
/// eklendiğinde/güncellendiğinde bu satır senkronize edilir. Kullanıcı başına film başına
/// tek satır vardır. Site geneli AverageRating hesabının tek kaynağı budur.
/// </summary>
public class MovieRating : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;
    public Guid MovieId { get; set; }
    public Movie Movie { get; set; } = default!;
    public decimal Value { get; set; }
}