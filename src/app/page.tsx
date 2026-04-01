"use client";

import Link from "next/link";
import { QuickLinksCard } from "@/components/dashboard/QuickLinksCard";
import { ContentCard } from "@/components/dashboard/ContentCard";
import { useSettings } from "@/contexts/settings-context";

export default function HomePage() {
  const { t } = useSettings();

  return (
    <div className="grid gap-4">
      <ContentCard title={t.dashboard.welcomeTitle}>
        <p className="text-sm text-[var(--muted-fg)]">{t.dashboard.welcomeBody}</p>
        <Link
          className="mt-3 inline-flex text-sm text-[var(--link-fg)] transition-colors hover:text-[var(--link-fg-hover)]"
          href="/listing-sessions/new"
        >
          {t.dashboard.openListingSessions}
        </Link>
      </ContentCard>
      <QuickLinksCard />
    </div>
  );
}
