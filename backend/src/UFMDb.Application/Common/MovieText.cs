using UFMDb.Domain.Entities;

namespace UFMDb.Application.Common;

/// <summary>Materialize edilmiş entity'ler için "Tr boşsa İngilizce'ye düş" kuralı.
/// (EF projeksiyonlarında bunun yerine satır içi ifade kullanılır, bkz. ScreeningLog.)</summary>
public static class MovieText
{
    public static string Title(Movie m, bool isTr) =>
        isTr && !string.IsNullOrWhiteSpace(m.TitleTr) ? m.TitleTr : m.Title;

    public static string Overview(Movie m, bool isTr) =>
        isTr && !string.IsNullOrWhiteSpace(m.OverviewTr) ? m.OverviewTr : m.Overview;

    public static string GenreName(Genre g, bool isTr) =>
        isTr && !string.IsNullOrWhiteSpace(g.NameTr) ? g.NameTr : g.Name;
}