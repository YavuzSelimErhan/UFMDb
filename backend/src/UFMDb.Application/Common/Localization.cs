namespace UFMDb.Application.Common;

public static class Localization
{
    public static bool IsTurkish(string? lang) =>
        lang?.StartsWith("tr", StringComparison.OrdinalIgnoreCase) == true;

    /// <summary>Bellekte kullanım için. EF sorgularının içinde bunun yerine inline ternary yaz.</summary>
    public static string Pick(bool turkish, string en, string tr) =>
        turkish && !string.IsNullOrWhiteSpace(tr) ? tr : en;
}