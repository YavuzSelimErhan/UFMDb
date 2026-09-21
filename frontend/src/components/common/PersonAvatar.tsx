import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { getEntityTheme } from "@/utils/listTheme";
import "./PersonAvatar.css";

type Size = "sm" | "md" | "lg";

interface Props {
  id: string;
  photoUrl?: string | null;
  fullName: string;
  size?: Size;
  className?: string;
}

export default function PersonAvatar({
  id,
  photoUrl,
  fullName,
  size = "md",
  className,
}: Props) {
  const [failed, setFailed] = useState(false);

  // Farklı bir kişi için aynı component instance'ı yeniden kullanılırsa
  // (liste kaydırma/sayfalama), önceki kişinin hata durumu taşınmasın.
  useEffect(() => {
    setFailed(false);
  }, [id, photoUrl]);

  const theme = getEntityTheme(id);
  const showFallback = !photoUrl || failed;
  const sizeClass = `person-avatar--${size}`;
  const classes = `person-avatar ${sizeClass}${className ? ` ${className}` : ""}`;

  if (showFallback) {
    return (
      <div
        className={`${classes} person-avatar--fallback`}
        style={
          {
            "--fallback-accent": theme.accent,
            "--fallback-accent-soft": theme.accentSoft,
          } as React.CSSProperties
        }
        role="img"
        aria-label={fullName}
      >
        <User className="person-avatar__icon" />
      </div>
    );
  }

  return (
    <img
      src={photoUrl!}
      alt={fullName}
      className={classes}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
