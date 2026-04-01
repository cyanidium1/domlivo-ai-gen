import type { ReactNode } from "react";

type ContentCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ContentCard({ title, subtitle, children }: ContentCardProps) {
  return (
    <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--panel-bg)] p-5">
      <h3 className="text-base font-semibold text-[var(--app-fg)]">{title}</h3>
      {subtitle ? <p className="mt-2 text-sm text-[var(--muted-fg)]">{subtitle}</p> : null}
      {children}
    </section>
  );
}

