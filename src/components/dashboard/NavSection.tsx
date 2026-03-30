import type { ReactNode } from "react";

import styles from "@/components/dashboard/dashboard.module.css";

type NavSectionProps = {
  title: string;
  children: ReactNode;
};

export function NavSection({ title, children }: NavSectionProps) {
  return (
    <section>
      <p className={styles.sectionTitle}>{title}</p>
      {children}
    </section>
  );
}

