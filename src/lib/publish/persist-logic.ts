import type { PublishListingInput } from "@/lib/publish/types";

export function resolveTargetDocumentId(input: PublishListingInput): { id: string; action: "created" | "updated" } {
  if (input.existingSanityDocumentId?.trim()) {
    return { id: input.existingSanityDocumentId.trim(), action: "updated" };
  }
  return { id: `property-${input.sessionId}`, action: "created" };
}

export function resolveLifecycleForMode(mode: PublishListingInput["mode"]): {
  isPublished: boolean;
  lifecycleStatus: "draft" | "active";
} {
  return mode === "property"
    ? { isPublished: true, lifecycleStatus: "active" }
    : { isPublished: false, lifecycleStatus: "draft" };
}
