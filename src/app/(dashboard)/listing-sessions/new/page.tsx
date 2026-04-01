"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ContentCard } from "@/components/dashboard/ContentCard";
import { useSettings } from "@/contexts/settings-context";

export default function NewListingSessionPage() {
  const router = useRouter();
  const { t } = useSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/listing-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent-mvp" }),
      });

      if (!response.ok) {
        throw new Error(t.dashboard.createSessionError);
      }

      const data = await response.json();
      router.push(`/listing-sessions/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.dashboard.createSessionError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <ContentCard
        title={t.dashboard.createSessionTitle}
        subtitle={t.dashboard.createSessionSubtitle}
      >
        <button
          className="inline-flex cursor-pointer items-center rounded-xl border border-[var(--app-border)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-medium text-[var(--app-fg)] transition-colors hover:bg-[var(--panel-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={createSession}
          disabled={loading}
        >
          {loading ? t.dashboard.creatingSession : t.dashboard.createSessionButton}
        </button>
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
      </ContentCard>
    </div>
  );
}
