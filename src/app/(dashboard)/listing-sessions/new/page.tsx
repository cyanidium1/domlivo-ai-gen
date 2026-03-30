"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ContentCard } from "@/components/dashboard/ContentCard";
import styles from "@/components/dashboard/dashboard.module.css";

export default function NewListingSessionPage() {
  const router = useRouter();
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
        throw new Error("Failed to create session");
      }

      const data = await response.json();
      router.push(`/listing-sessions/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.stack}>
      <ContentCard
        title="Create New Listing Session"
        subtitle="Start a new intake workspace for photos, audio, source notes, draft generation, and publish."
      >
        <button className={styles.button} type="button" onClick={createSession} disabled={loading}>
          {loading ? "Creating..." : "Create session"}
        </button>
        {error && <p style={{ color: "#f4a6a6" }}>{error}</p>}
      </ContentCard>
    </div>
  );
}
