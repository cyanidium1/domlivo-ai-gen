"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import styles from "@/components/dashboard/dashboard.module.css";

type DashboardShellProps = {
  children: ReactNode;
};

function titleFromPath(pathname: string): string {
  if (pathname.startsWith("/listing-sessions")) return "Listing Sessions";
  if (pathname.startsWith("/blog-posts")) return "Blog Posts";
  if (pathname.startsWith("/project-types")) return "Other Project Types";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const title = useMemo(() => titleFromPath(pathname), [pathname]);

  return (
    <div className={styles.shell}>
      <DashboardSidebar open={open} onNavigate={() => setOpen(false)} />
      {open ? <div className={styles.sidebarMobileOverlay} onClick={() => setOpen(false)} /> : null}
      <div className={styles.contentArea}>
        <DashboardHeader title={title} onMenuClick={() => setOpen((v) => !v)} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

