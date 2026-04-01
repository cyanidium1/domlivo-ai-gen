"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavSection } from "@/components/dashboard/NavSection";
import { useSettings } from "@/contexts/settings-context";
import styles from "@/components/dashboard/dashboard.module.css";

type DashboardSidebarProps = {
  open: boolean;
  onNavigate: () => void;
};

export function DashboardSidebar({ open, onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { t } = useSettings();
  const mainNav = [
    { href: "/listing-sessions/new", label: t.nav.listingSessions },
    { href: "/blog-posts", label: t.nav.blogPosts },
    { href: "/project-types", label: t.nav.projectTypes },
    { href: "/settings", label: t.nav.settings },
  ];

  return (
    <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
      <div className={styles.brandRow} aria-label="Domlivo Admin">
        <span className={styles.logoWrapper} aria-hidden="true">
          <img className={styles.brandLogo} src="/brand/domlivo-logo.svg" alt="" />
        </span>
        <span className={styles.brandText}>
          <span className={styles.aiGradientText}>AI Agent</span>
        </span>
      </div>

      <NavSection title={t.nav.workspace}>
        <ul className={styles.navList}>
          {mainNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </NavSection>

      <NavSection title={t.nav.utilities}>
        <a className={styles.utilityLink} href="http://localhost:3333" target="_blank" rel="noreferrer">
          {t.nav.openStudio}
        </a>
        <a className={styles.utilityLink} href="http://localhost:3000" target="_blank" rel="noreferrer">
          {t.nav.openFrontend}
        </a>
        <a className={styles.utilityLink} href="#" onClick={(e) => e.preventDefault()}>
          {t.nav.internalPreview}
        </a>
      </NavSection>

      <div className={styles.accountBox}>
        <div className={styles.accountName}>{t.nav.operator}</div>
        <button className={styles.accountAction} type="button">
          {t.nav.profile}
        </button>
        <button className={styles.accountAction} type="button">
          {t.nav.loginLogout}
        </button>
      </div>
    </aside>
  );
}

