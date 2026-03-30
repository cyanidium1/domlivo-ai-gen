import type { ListingDraft } from "@/lib/validation/listing-session";
import { buildPublishPayload } from "@/lib/listing-session/publish-payload";

function hasText(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasNumber(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * "Meaningful" content heuristic for draft publishing.
 * Intentionally permissive: if the listing isn't completely empty, allow draft save/publish.
 */
export function canPublishDraft(params: {
  sourceText?: string | null;
  draft: ListingDraft | null | undefined;
  extractedFacts?: unknown;
  assetsCount?: number;
}): boolean {
  const { sourceText, draft, extractedFacts, assetsCount = 0 } = params;

  if (hasText(sourceText)) return true;
  if (assetsCount > 0) return true;
  if (draft) {
    if (hasText(draft.title?.en)) return true;
    if (hasText(draft.shortDescription?.en)) return true;
    if (hasText(draft.description?.en)) return true;
    if (hasNumber(draft.price)) return true;
    if (hasText(draft.facts?.propertyType)) return true;
    if (hasNumber(draft.facts?.area)) return true;
    if (hasText(draft.dealStatus)) return true;
    if (hasText(draft.address?.city)) return true;
    if (hasText(draft.address?.displayAddress?.en)) return true;
    if ((draft.gallery?.length ?? 0) > 0) return true;
  }

  // Fallback: if extractedFacts exists and isn't an empty object, treat as meaningful.
  if (extractedFacts && typeof extractedFacts === "object" && !Array.isArray(extractedFacts)) {
    if (Object.keys(extractedFacts as Record<string, unknown>).length > 0) return true;
  }

  return false;
}

export function canPublishProperty(params: {
  sessionId: string;
  editedDraft: ListingDraft | null | undefined;
  confirmation?: unknown;
  galleryAltIssues: number;
}): boolean {
  const { sessionId, editedDraft, confirmation, galleryAltIssues } = params;
  if (!editedDraft) return false;
  if (galleryAltIssues > 0) return false;
  const gate = buildPublishPayload({ id: sessionId, editedDraft, confirmation });
  return gate.ok;
}

export function actionButtonClass(params: { disabled: boolean; tone: "primary" | "secondary" | "ghost" }): string {
  const base =
    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed";
  const tone =
    params.tone === "primary"
      ? "border-slate-700 bg-slate-900/50 text-slate-100 hover:bg-slate-900/80"
      : params.tone === "secondary"
        ? "border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900/40"
        : "border-transparent bg-transparent text-slate-200 hover:bg-slate-900/30";
  // disabled handled by utility classes; keep deterministic output
  return [base, tone].join(" ");
}
