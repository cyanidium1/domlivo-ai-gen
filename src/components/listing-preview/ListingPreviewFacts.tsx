type Props = {
  items: Array<{ label: string; value: string }>;
};

export function ListingPreviewFacts({ items }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3"
        >
          <div className="text-[11px] uppercase tracking-wider text-slate-400">{it.label}</div>
          <div className="mt-1 text-sm text-slate-100">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

