import { useState } from "react";

interface Props {
  src?: string | null;
  name: string;
  shape?: "poster" | "round";
}

/** Küçük görsel: poster (film/liste) ya da yuvarlak avatar. Görsel yoksa/bozuksa baş harfler gösterilir. */
export default function AdminThumb({ src, name, shape = "round" }: Props) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <span className={`admin-thumb admin-thumb--${shape}`}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span>{initials || "?"}</span>
      )}
    </span>
  );
}
