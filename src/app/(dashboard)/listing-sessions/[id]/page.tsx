"use client";

import { useParams } from "next/navigation";
import { Form } from "@/components/listing-session/Form";
import { ContentCard } from "@/components/dashboard/ContentCard";
import { useSettings } from "@/contexts/settings-context";

export default function ListingSessionPage() {
  const params = useParams<{ id: string }>();
  const { t } = useSettings();
  const id = params.id;

  return (
    <div className="grid gap-4">
      <ContentCard title={t.dashboard.listingEditorTitle} subtitle={t.dashboard.listingEditorSubtitle}>
        <p className="text-sm text-[var(--muted-fg)]">
          {t.dashboard.sessionId}: {id}
        </p>
      </ContentCard>
      <Form sessionId={id} />
    </div>
  );
}
