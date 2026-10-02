import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { passwordRules } from "@/utils/passwordRules";

interface PasswordChecklistProps {
  password: string;
  /** false iken (kullanıcı henüz hiç yazmadıysa) kurallar kırmızı/çarpı
   *  yerine nötr gri görünür — sayfa açılır açılmaz "hata" görüntüsü
   *  vermemek için. */
  touched: boolean;
}

/**
 * Şifre alanının hemen altında gösterilen, her kuralın anlık durumunu
 * (✓ sağlandı / ✗ sağlanmadı) renkli ikonla gösteren kalıcı bir kontrol
 * listesi. Kurallar passwordRules.ts'den okunur — tek kaynak.
 */
export default function PasswordChecklist({
  password,
  touched,
}: PasswordChecklistProps) {
  const { t } = useTranslation();

  return (
    <ul
      className="password-checklist"
      style={{ listStyle: "none", margin: "6px 0 14px", padding: 0 }}
    >
      {passwordRules.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.messageKey}
            className={`password-checklist__item${
              touched ? (ok ? " is-met" : " is-unmet") : ""
            }`}
          >
            {touched ? (
              ok ? (
                <Check size={13} />
              ) : (
                <X size={13} />
              )
            ) : (
              <span className="password-checklist__dot" />
            )}
            {t(rule.messageKey)}
          </li>
        );
      })}
    </ul>
  );
}
