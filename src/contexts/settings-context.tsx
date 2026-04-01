"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { UI_MESSAGES, type AppLanguage } from "@/lib/i18n/messages";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, type AppTheme, parseStoredSettings } from "@/lib/settings/model";

type SettingsContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  t: typeof UI_MESSAGES.en;
};

const SettingsContext = createContext<SettingsContextValue>({
  language: DEFAULT_SETTINGS.language,
  setLanguage: () => {},
  theme: DEFAULT_SETTINGS.theme,
  setTheme: () => {},
  t: UI_MESSAGES.en,
});

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_SETTINGS.language);
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_SETTINGS.theme);

  useEffect(() => {
    try {
      const stored = parseStoredSettings(localStorage.getItem(SETTINGS_STORAGE_KEY));
      setLanguageState(stored.language);
      setThemeState(stored.theme);
      applyTheme(stored.theme);
    } catch {
      applyTheme(DEFAULT_SETTINGS.theme);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ language, theme }));
    } catch {
      // ignore storage failures
    }
    applyTheme(theme);
  }, [language, theme]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      theme,
      setTheme: setThemeState,
      t: UI_MESSAGES[language],
    }),
    [language, theme],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

