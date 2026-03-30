"use client";

import type { ListingSessionResponse } from "@/lib/listing-session/client";
import { evaluatePublishReadiness } from "@/lib/listing-session/readiness";

type Props = {
  session: ListingSessionResponse | null;
};

export function AIClarificationPanel({ session }: Props) {
  const readiness = evaluatePublishReadiness(session);
  const hasIssues =
    readiness.missingCritical.length ||
    readiness.recommendedFixes.length ||
    readiness.optionalSuggestions.length;

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">AI Clarification</h3>
          <p className="mt-1 text-xs text-slate-400">
            Structured checklist derived from candidate facts and current draft. No chat backend.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-300">
          Editor assist
        </span>
      </div>

      {!hasIssues ? (
        <p className="mt-3 text-sm text-slate-300">No obvious missing fields detected.</p>
      ) : (
        <div className="mt-3 grid gap-2.5">
          {readiness.missingCritical.length ? (
            <div className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-200">Critical</div>
              <div className="mt-1 text-sm text-slate-200">{readiness.missingCritical.join(", ")}</div>
            </div>
          ) : null}

          {readiness.recommendedFixes.length ? (
            <div className="rounded-xl border border-sky-900/50 bg-sky-950/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-200">Recommended</div>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-200">
                {readiness.recommendedFixes.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {readiness.optionalSuggestions.length ? (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                Optional
              </div>
              <ul className="m-0 list-disc pl-5 text-sm text-slate-200">
                {readiness.optionalSuggestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

