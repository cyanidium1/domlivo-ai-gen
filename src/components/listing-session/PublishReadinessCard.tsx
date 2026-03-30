"use client";

import type { PublishReadiness } from "@/lib/listing-session/readiness";

type Props = {
  readiness: PublishReadiness;
};

export function PublishReadinessCard({ readiness }: Props) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Publish Readiness</h3>
          <p className="mt-1 text-xs text-slate-400">UI-side evaluator based on current draft, extracted facts and gallery.</p>
        </div>
        <span
          className={[
            "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
            readiness.isReady
              ? "border-emerald-700/60 bg-emerald-950/20 text-emerald-200"
              : "border-rose-800/60 bg-rose-950/20 text-rose-200",
          ].join(" ")}
        >
          {readiness.isReady ? "Ready to publish" : "Not ready"}
        </span>
      </div>

      {!readiness.isReady ? (
        <div className="mt-3 rounded-xl border border-rose-900/60 bg-rose-950/20 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-200">Missing critical</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-200">
            {readiness.missingCritical.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {readiness.recommendedFixes.length ? (
        <div className="mt-3 rounded-xl border border-sky-900/50 bg-sky-950/20 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-200">Recommended</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-200">
            {readiness.recommendedFixes.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {readiness.optionalSuggestions.length ? (
        <div className="mt-3 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">Optional</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-200">
            {readiness.optionalSuggestions.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

