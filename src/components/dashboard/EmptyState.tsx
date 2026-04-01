type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--panel-bg)] p-5">
      <h3 className="text-base font-semibold text-[var(--app-fg)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted-fg)]">{description}</p>
    </section>
  );
}

