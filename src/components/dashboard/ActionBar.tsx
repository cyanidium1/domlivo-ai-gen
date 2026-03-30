import type { ReactNode } from "react";

import styles from "@/components/dashboard/dashboard.module.css";

type ActionBarProps = {
  children: ReactNode;
};

export function ActionBar({ children }: ActionBarProps) {
  return <div className={styles.actionBar}>{children}</div>;
}

