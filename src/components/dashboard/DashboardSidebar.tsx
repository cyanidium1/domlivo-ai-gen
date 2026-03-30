"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavSection } from "@/components/dashboard/NavSection";
import styles from "@/components/dashboard/dashboard.module.css";

type DashboardSidebarProps = {
  open: boolean;
  onNavigate: () => void;
};

const mainNav = [
  { href: "/listing-sessions/new", label: "Listing Sessions / Real Estate" },
  { href: "/blog-posts", label: "Blog Posts" },
  { href: "/project-types", label: "Other Project Types" },
  { href: "/settings", label: "Settings" },
];

export function DashboardSidebar({ open, onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
      <div className={styles.brandRow} aria-label="Domlivo Admin">
        <span className={styles.logoWrapper} aria-hidden="true">
          <img className={styles.brandLogo} src="/brand/domlivo-logo.svg" alt="" />
        </span>
        <span className={styles.brandText}>
          <span className={styles.aiGradientText}>AI</span>
        </span>
      </div>

      <NavSection title="Workspace">
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

      <NavSection title="Utilities">
        <a className={styles.utilityLink} href="http://localhost:3333" target="_blank" rel="noreferrer">
          Open Sanity Studio
        </a>
        <a className={styles.utilityLink} href="http://localhost:3000" target="_blank" rel="noreferrer">
          Open Domlivo Frontend
        </a>
        <a className={styles.utilityLink} href="#" onClick={(e) => e.preventDefault()}>
          Internal Preview (placeholder)
        </a>
      </NavSection>

      <div className={styles.accountBox}>
        <div className={styles.accountName}>Operator (placeholder)</div>
        <button className={styles.accountAction} type="button">
          Profile
        </button>
        <button className={styles.accountAction} type="button">
          Login / Logout
        </button>
      </div>
    </aside>
  );
}

