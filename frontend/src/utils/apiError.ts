/**
 * Backend (ASP.NET Core / FluentValidation) doğrulama hatalarını okumak
 * için ortak yardımcı. Sunucu şu şekilde bir gövde dönüyor:
 *
 *   {
 *     "title": "Doğrulama hatası",
 *     "errors": {
 *       "Password": ["Şifre en az bir büyük harf içermeli.", "..."],
 *       "Email": ["..."]
 *     }
 *   }
 *
 * Önceki kod sadece `title`'ı okuyordu; bu yüzden kullanıcı her zaman
 * genel "Doğrulama hatası" metnini görüyordu. Bu dosya `errors` içindeki
 * alan bazlı mesajları da çıkarır.
 */

export type FieldErrors = Record<string, string[]>;

interface ValidationProblemDetails {
  title?: string;
  errors?: FieldErrors;
}

export interface ParsedApiError {
  /** Backend'in genel başlığı (fallback ile). */
  title: string;
  /** Alan adı -> o alana ait mesaj(lar). Anahtarlar backend'in gönderdiği
   *  şekildedir (genelde PascalCase, ör. "Password"). */
  fieldErrors: FieldErrors;
  /** İlk alan hatasının ilk mesajı — tek bir özet göstermek isteyen
   *  formlar için (ör. genel bir banner). */
  firstFieldMessage?: string;
}

/**
 * Bir axios/fetch hatasını parse eder. `fallbackTitle`, backend'den hiç
 * ValidationProblemDetails gelmediği durumlarda (ağ hatası, 500 vb.)
 * kullanılır.
 */
export function parseApiError(
  err: unknown,
  fallbackTitle: string,
): ParsedApiError {
  const data = (err as { response?: { data?: ValidationProblemDetails } })
    ?.response?.data;

  const fieldErrors = data?.errors ?? {};
  const firstFieldMessage = Object.values(fieldErrors)[0]?.[0];

  return {
    title: data?.title ?? fallbackTitle,
    fieldErrors,
    firstFieldMessage,
  };
}

/**
 * Belirli bir alanın backend mesajlarını döndürür. Anahtar karşılaştırması
 * büyük/küçük harfe duyarsızdır, çünkü backend "Password" gönderirken
 * frontend formu "password" adını kullanıyor olabilir.
 */
export function fieldErrorMessages(
  fieldErrors: FieldErrors,
  fieldName: string,
): string[] {
  const key = Object.keys(fieldErrors).find(
    (k) => k.toLowerCase() === fieldName.toLowerCase(),
  );
  return key ? fieldErrors[key] : [];
}
