export function getImageUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path; // zaten tam URL ise dokunma
  const base = import.meta.env.VITE_API_URL || "";
  return `${base}${path}`;
}
