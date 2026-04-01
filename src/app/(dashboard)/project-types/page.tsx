"use client";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { useSettings } from "@/contexts/settings-context";

export default function ProjectTypesPage() {
  const { t } = useSettings();

  return (
    <EmptyState
      title={t.dashboard.projectTypesPlaceholderTitle}
      description={t.dashboard.projectTypesPlaceholderDescription}
    />
  );
}

