"use client";

import type { ReactNode } from "react";

import { useSettings } from "@/contexts/settings-context";
import type { AppLanguage } from "@/lib/i18n/messages";

export type { AppLanguage };

type LanguageContextValue = {
  appLanguage: AppLanguage;
  setAppLanguage: (lang: AppLanguage) => void;
};

// Backward-compatible adapter so existing components can keep using useAppLanguage.
export function LanguageProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAppLanguage(): LanguageContextValue {
  const { language, setLanguage } = useSettings();
  return { appLanguage: language, setAppLanguage: setLanguage };
}
