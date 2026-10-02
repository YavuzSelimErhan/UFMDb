/**
 * Şifre kuralları — TEK kaynak. Hem canlı checklist UI'ı (RegisterPage)
 * hem de submit-öncesi istemci doğrulaması buradan okur.
 *
 * ÖNEMLİ: Bu kurallar backend'deki FluentValidation `Matches(...)`
 * kurallarıyla BİREBİR eşleşir:
 *
 *   RuleFor(x => x.Password).NotEmpty().MinimumLength(8)
 *       .Matches("[A-Z]")   // yalnızca ASCII büyük harf
 *       .Matches("[0-9]");
 *
 * Backend küçük harf şartı KOYMUYOR ve büyük harf kontrolü yalnızca ASCII
 * [A-Z] — Türkçe büyük harfleri (Ç, Ğ, İ, Ö, Ş, Ü) saymıyor. Önceki
 * sürümde frontend Türkçe karakterleri de büyük/küçük harf sayıyor ve
 * ayrıca küçük harf şartı koşuyordu; bu da istemcide "geçerli" görünüp
 * backend'de 400 ile reddedilen şifrelere (ör. yalnızca "Ğ" gibi bir
 * Türkçe büyük harf içeren şifreler) yol açıyordu. Bu dosya artık
 * backend'le birebir aynı.
 *
 * Backend validator'ı değişirse bu dosyayı da aynı anda güncelleyin.
 */

export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
  /** Şifre bu kuralı sağlıyor mu? */
  test: (password: string) => boolean;
  /** i18n anahtarı — auth.* namespace'i altında. */
  messageKey: string;
}

export const passwordRules: PasswordRule[] = [
  {
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
    messageKey: "auth.passwordRuleLength",
  },
  {
    // Backend'in Matches("[A-Z]") kuralıyla birebir: yalnızca ASCII
    // büyük harf. Türkçe Ç/Ğ/İ/Ö/Ş/Ü burada SAYILMAZ.
    test: (p) => /[A-Z]/.test(p),
    messageKey: "auth.passwordRuleUppercase",
  },
  {
    // Backend'in Matches("[0-9]") kuralıyla birebir.
    test: (p) => /[0-9]/.test(p),
    messageKey: "auth.passwordRuleDigit",
  },
];

export function isPasswordValid(password: string): boolean {
  return passwordRules.every((r) => r.test(password));
}

/** Sağlanmayan kuralların i18n mesajlarını döndürür (submit-öncesi özet için). */
export function getFailingPasswordMessages(
  password: string,
  t: (key: string) => string,
): string[] {
  return passwordRules
    .filter((r) => !r.test(password))
    .map((r) => t(r.messageKey));
}
