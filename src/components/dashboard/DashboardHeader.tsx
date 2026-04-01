"use client";

import { useSettings } from "@/contexts/settings-context";
import styles from "@/components/dashboard/dashboard.module.css";

type DashboardHeaderProps = {
  title: string;
  onMenuClick: () => void;
};

export function DashboardHeader({ title, onMenuClick }: DashboardHeaderProps) {
  const { t } = useSettings();

  return (
    <header className={styles.header}>
      <button className={styles.menuButton} type="button" onClick={onMenuClick}>
        {t.common.menu}
      </button>
      <h1 className={styles.headerTitle}>{title}</h1>
      <div className={styles.mutedHeaderHint}>{t.common.settings}</div>
    </header>
  );
}
