/**
 * Şifre kuralları — TEK kaynak. Hem canlı checklist UI'ı (RegisterPage)
 * hem de submit-öncesi istemci doğrulaması buradan okur.
 *
 * ÖNEMLİ: Bu kurallar backend'deki FluentValidation `Matches(...)`
 * kurallarıyla BİREBİR eşleşmeli. Eşleşmezse istemci "geçerli" derken
 * sunucu reddedebilir, ya da tam tersi — kullanıcı için kafa karıştırıcı
 * olur. Backend validator'ınızı kontrol edip aşağıdaki testleri /
 * mesajları ona göre güncelleyin.
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
    test: (p) => /[A-ZÇĞİÖŞÜ]/.test(p),
    messageKey: "auth.passwordRuleUppercase",
  },
  {
    test: (p) => /[a-zçğıöşü]/.test(p),
    messageKey: "auth.passwordRuleLowercase",
  },
  {
    test: (p) => /\d/.test(p),
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
