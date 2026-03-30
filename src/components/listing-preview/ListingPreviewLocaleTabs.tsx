"use client";

import type { PreviewLocale } from "@/lib/listing-session/preview-mapper";

const locales: PreviewLocale[] = ["EN", "UK", "RU", "SQ", "IT"];

type Props = {
  value: PreviewLocale;
  onChange: (value: PreviewLocale) => void;
};

export function ListingPreviewLocaleTabs({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-full border border-slate-700 bg-slate-950/40 p-1 gap-1"
      role="tablist"
      aria-label="Preview locale"
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          role="tab"
          aria-selected={value === l}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80",
            value === l ? "bg-slate-800 text-slate-100" : "text-slate-300 hover:text-slate-100",
          ].join(" ")}
          onClick={() => onChange(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

