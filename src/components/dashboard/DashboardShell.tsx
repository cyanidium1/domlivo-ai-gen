"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { useSettings } from "@/contexts/settings-context";
import styles from "@/components/dashboard/dashboard.module.css";

type DashboardShellProps = {
  children: ReactNode;
};

function titleFromPath(
  pathname: string,
  labels: { listingSessions: string; blogPosts: string; projectTypes: string; settings: string; dashboard: string },
): string {
  if (pathname.startsWith("/listing-sessions")) return labels.listingSessions;
  if (pathname.startsWith("/blog-posts")) return labels.blogPosts;
  if (pathname.startsWith("/project-types")) return labels.projectTypes;
  if (pathname.startsWith("/settings")) return labels.settings;
  return labels.dashboard;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useSettings();
  const title = useMemo(
    () =>
      titleFromPath(pathname, {
        listingSessions: t.pages.listingSessions,
        blogPosts: t.pages.blogPosts,
        projectTypes: t.pages.projectTypes,
        settings: t.pages.settings,
        dashboard: t.common.dashboard,
      }),
    [pathname, t],
  );

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

