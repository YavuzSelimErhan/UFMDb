namespace UFMDb.Application.Common.Services;

/// <summary>CSV hücre biçimlendirme. Export ve import aynı kuralı kullanır.</summary>
public static class CsvFormat
{
    private static bool IsRisky(char c) => c is '=' or '+' or '-' or '@' or '\t' or '\r';

    /// <summary>
    /// Metin hücresini tırnaklar. Excel'in formül olarak çalıştıracağı başlangıç karakterlerinin
    /// önüne ' koyar (CSV enjeksiyonu önlemi). Import bu öneki geri soyar.
    /// </summary>
    public static string Field(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (IsRisky(value[0])) value = "'" + value;
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }

    /// <summary>Field'ın eklediği ' önekini geri alır (yalnızca ' + riskli karakter ise).</summary>
    public static string? Unescape(string? value)
    {
        if (value is { Length: > 1 } && value[0] == '\'' && IsRisky(value[1]))
            return value[1..];
        return value;
    }
}