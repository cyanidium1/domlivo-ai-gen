import type { ReactNode } from "react";

import styles from "@/components/dashboard/dashboard.module.css";

type ContentCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ContentCard({ title, subtitle, children }: ContentCardProps) {
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {subtitle ? <p className={styles.muted}>{subtitle}</p> : null}
      {children}
    </section>
  );
}

