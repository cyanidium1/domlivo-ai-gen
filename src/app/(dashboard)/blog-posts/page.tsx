"use client";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { useSettings } from "@/contexts/settings-context";

export default function BlogPostsPage() {
  const { t } = useSettings();

  return (
    <EmptyState
      title={t.dashboard.blogPlaceholderTitle}
      description={t.dashboard.blogPlaceholderDescription}
    />
  );
}

