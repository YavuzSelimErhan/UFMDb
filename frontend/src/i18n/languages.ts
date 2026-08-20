// Vite'ın statik analiz edebilmesi için glob pattern literal string olmalı (değişken kullanılamaz)
const modules = import.meta.glob("./locales/*/translation.json", {
  eager: true,
}) as Record<string, { default: Record<string, unknown> }>;

export const languageResources: Record<
  string,
  { translation: Record<string, unknown> }
> = {};

for (const path in modules) {
  const match = path.match(/\.\/locales\/([a-zA-Z-]+)\/translation\.json$/);
  if (!match) continue;
  const code = match[1];
  languageResources[code] = { translation: modules[path].default };
}

export const SUPPORTED_LANGUAGES = Object.keys(languageResources).sort();

export const languageLabel = (code: string) => code.toUpperCase();
