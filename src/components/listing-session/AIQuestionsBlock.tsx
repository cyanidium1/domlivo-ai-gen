"use client";

import { useMemo, useState } from "react";

import type { IntakeAnalysisResponse } from "@/lib/listing-session/client";

type Props = {
  intake: IntakeAnalysisResponse | null;
  onSubmitAnswer: (answer: string) => Promise<void>;
  onRunIntake: () => Promise<void>;
  onGenerateFullListing: () => Promise<void>;
  loading?: boolean;
};

export function AIQuestionsBlock({ intake, onSubmitAnswer, onRunIntake, onGenerateFullListing, loading }: Props) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requiredLabels = useMemo(
    () =>
      (intake?.missingRequiredFacts ?? []).map((fact) => {
        switch (fact) {
          case "price":
            return "Price (EUR)";
          case "city":
            return "City";
          case "propertyType":
            return "Property type";
          case "dealStatus":
            return "Deal status (sale/rent/short-term)";
          case "area":
            return "Area (m²)";
          case "photo":
            return "At least one photo";
        }
      }),
    [intake?.missingRequiredFacts],
  );

  const send = async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await onSubmitAnswer(answer.trim());
      setAnswer("");
      setMessage("Answer saved. Intake was re-evaluated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/30 p-4">
      <h3 className="text-sm font-semibold text-slate-100">AI Questions / Clarification Chat</h3>
      <p className="mt-1 text-xs text-slate-400">Guided intake: answer missing facts, then generate full listing.</p>

      {!intake ? (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/20 p-3 text-sm text-slate-300">
          Run intake analysis to get AI questions.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Required missing facts</div>
            {requiredLabels.length ? (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-200">
                {requiredLabels.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-emerald-300">All required facts are complete.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">AI asks</div>
            <div className="mt-2 grid gap-2">
              {(intake.questionsForUser.length ? intake.questionsForUser : ["No more questions right now."]).map((q) => (
                <div key={q} className="max-w-[90%] rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-sm text-slate-100">
                  {q}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/20 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">Your answer</div>
        <div className="flex flex-col gap-2 lg:flex-row">
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
            placeholder="Example: Price is 220000 EUR, city is Tirana, area is 87 m2..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <button
            className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/70 disabled:opacity-60"
            type="button"
            onClick={send}
            disabled={submitting || loading || !answer.trim()}
          >
            {submitting ? "Sending..." : "Send answer"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/70 disabled:opacity-60"
          type="button"
          onClick={() => void onRunIntake()}
          disabled={loading || submitting}
        >
          Run intake analysis
        </button>
        <button
          className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900 disabled:opacity-60"
          type="button"
          onClick={() => void onGenerateFullListing()}
          disabled={loading || submitting || !intake?.isReadyForDraft}
        >
          Generate Full Listing
        </button>
        {message ? <span className="text-xs text-slate-300">{message}</span> : null}
      </div>
    </section>
  );
}

