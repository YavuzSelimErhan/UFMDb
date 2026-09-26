using UFMDb.Domain.Common;
using UFMDb.Domain.Enums;

namespace UFMDb.Domain.Entities;

/// <summary>
/// Kullaniciya gosterilecek bildirim (takip, vb.).
/// Type + EntityId genel amacli tutuldu ki ileride yorum begenisi, liste begenisi gibi
/// yeni bildirim turleri eklenirken yeni bir tablo/migration gerekmesin.
/// </summary>
public class Notification : BaseEntity
{
    public Guid RecipientUserId { get; set; }
    public User RecipientUser { get; set; } = default!;

    /// <summary>Bildirimi tetikleyen kullanici (varsa) — orn. takip eden kisi.</summary>
    public Guid? ActorUserId { get; set; }
    public User? ActorUser { get; set; }

    public NotificationType Type { get; set; }

    /// <summary>Ileride: begenilen review'in id'si, movie id'si vb. Follow bildiriminde kullanilmiyor.</summary>
    public Guid? EntityId { get; set; }

    public bool IsRead { get; set; } = false;
}