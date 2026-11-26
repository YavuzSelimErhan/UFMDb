import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  count?: number;
  /** Sağ üst köşe: genelde "Yeni ..." butonu */
  actions?: ReactNode;
}

export default function AdminSectionHeader({
  title,
  subtitle,
  count,
  actions,
}: Props) {
  return (
    <header className="admin-section-head">
      <div>
        <h2>
          {title}
          {count !== undefined && <span className="admin-count">{count}</span>}
        </h2>
        {subtitle && <p className="text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="admin-section-head__actions">{actions}</div>}
    </header>
  );
}
