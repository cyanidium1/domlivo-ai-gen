import { SUPPORTED_LANGUAGES, type AppLanguage } from "@/lib/i18n/messages";

export type AppTheme = "light" | "dark";

export type UserSettings = {
  language: AppLanguage;
  theme: AppTheme;
};

export const SETTINGS_STORAGE_KEY = "domlivo-user-settings";

export const DEFAULT_SETTINGS: UserSettings = {
  language: "en",
  theme: "dark",
};

export function isSupportedLanguage(value: string): value is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function parseStoredSettings(raw: string | null | undefined): UserSettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<UserSettings> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
    const language = typeof parsed.language === "string" && isSupportedLanguage(parsed.language)
      ? parsed.language
      : DEFAULT_SETTINGS.language;
    const theme = parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : DEFAULT_SETTINGS.theme;
    return { language, theme };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

