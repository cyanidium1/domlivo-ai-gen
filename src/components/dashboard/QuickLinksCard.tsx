"use client";

import { useSettings } from "@/contexts/settings-context";

export function QuickLinksCard() {
  const { t } = useSettings();
  return (
    <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--panel-bg)] p-5">
      <h3 className="text-base font-semibold text-[var(--app-fg)]">{t.dashboard.quickLinks}</h3>
      <a
        className="mt-3 block text-sm text-[var(--link-fg)] transition-colors hover:text-[var(--link-fg-hover)]"
        href="http://localhost:3333"
        target="_blank"
        rel="noreferrer"
      >
        {t.dashboard.studio}
      </a>
      <a
        className="mt-2 block text-sm text-[var(--link-fg)] transition-colors hover:text-[var(--link-fg-hover)]"
        href="http://localhost:3000"
        target="_blank"
        rel="noreferrer"
      >
        {t.dashboard.frontend}
      </a>
      <a className="mt-2 block text-sm text-[var(--link-fg)] transition-colors hover:text-[var(--link-fg-hover)]" href="#">
        {t.dashboard.publishedObjects}
      </a>
    </section>
  );
}

