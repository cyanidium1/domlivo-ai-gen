"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AppLanguage = "en" | "ru" | "uk" | "sq" | "it";

const LANG_STORAGE_KEY = "domlivo-app-language";
const VALID_LANGS: AppLanguage[] = ["en", "ru", "uk", "sq", "it"];

type LanguageContextValue = {
  appLanguage: AppLanguage;
  setAppLanguage: (lang: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  appLanguage: "en",
  setAppLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [appLanguage, setAppLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored && (VALID_LANGS as string[]).includes(stored)) {
        setAppLanguageState(stored as AppLanguage);
      }
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, []);

  const setAppLanguage = (lang: AppLanguage) => {
    setAppLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  };

  return (
    <LanguageContext.Provider value={{ appLanguage, setAppLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useAppLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
