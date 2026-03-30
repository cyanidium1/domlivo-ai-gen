"use client";

import { useAppLanguage, type AppLanguage } from "@/contexts/language-context";
import styles from "@/components/dashboard/dashboard.module.css";

const LANG_LABELS: Record<AppLanguage, string> = {
  en: "EN",
  ru: "RU",
  uk: "UK",
  sq: "SQ",
  it: "IT",
};

type DashboardHeaderProps = {
  title: string;
  onMenuClick: () => void;
};

export function DashboardHeader({ title, onMenuClick }: DashboardHeaderProps) {
  const { appLanguage, setAppLanguage } = useAppLanguage();

  return (
    <header className={styles.header}>
      <button className={styles.menuButton} type="button" onClick={onMenuClick}>
        Menu
      </button>
      <h1 className={styles.headerTitle}>{title}</h1>
      <div className="flex rounded-lg border border-slate-700 overflow-hidden">
        {(Object.keys(LANG_LABELS) as AppLanguage[]).map((lang) => (
          <button
            key={lang}
            type="button"
            className={[
              "px-2 py-1 text-[11px] font-medium transition-colors",
              appLanguage === lang
                ? "bg-slate-700 text-slate-100"
                : "bg-transparent text-slate-400 hover:text-slate-200",
            ].join(" ")}
            onClick={() => setAppLanguage(lang)}
            title={`Interface language: ${LANG_LABELS[lang]}`}
          >
            {LANG_LABELS[lang]}
          </button>
        ))}
      </div>
    </header>
  );
}
