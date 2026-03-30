import {
  type PublishListingPayload,
  listingDraftSchema,
  publishListingPayloadSchema,
} from "@/lib/validation/listing-session";
import { getConfirmation, getUnconfirmedCriticalFields } from "@/lib/listing-session/confirmation";

export type PublishGateErrors = { missing: string[]; invalid: string[]; unconfirmed: string[] };

export type PublishGateResult =
  | { ok: true; payload: PublishListingPayload }
  | { ok: false; errors: PublishGateErrors };

function classifyValidationIssues(issues: Array<{ code: string; path: (string | number)[]; received?: string }>) {
  const missing = new Set<string>();
  const invalid = new Set<string>();
  for (const issue of issues) {
    const path = issue.path.join(".");
    if (!path) continue;
    if (issue.code === "invalid_type" && issue.received === "undefined") {
      missing.add(path);
    } else {
      invalid.add(path);
    }
  }
  return {
    missing: [...missing],
    invalid: [...invalid],
  };
}

export function buildPublishPayload(session: {
  id: string;
  editedDraft: unknown;
  confirmation?: unknown;
}): PublishGateResult {
  const draftParsed = listingDraftSchema.safeParse(session.editedDraft);
  if (!draftParsed.success) {
    const classified = classifyValidationIssues(
      draftParsed.error.issues.map((i) => ({ code: i.code, path: i.path, received: (i as { received?: string }).received })),
    );
    return {
      ok: false,
      errors: {
        ...classified,
        unconfirmed: [],
      },
    };
  }

  const draft = draftParsed.data;
  const unconfirmed = getUnconfirmedCriticalFields(draft, getConfirmation(session));
  const payloadCandidate = {
    ...draft,
    sourceSessionId: session.id,
  };

  const coverRef = payloadCandidate.coverImage?.asset?._ref;
  const hasCoverInGallery =
    coverRef && payloadCandidate.gallery?.some((item) => item.image.asset._ref === coverRef);
  if (coverRef && !hasCoverInGallery) {
    return {
      ok: false,
      errors: {
        missing: [],
        invalid: ["coverImage"],
        unconfirmed,
      },
    };
  }

  const publishParsed = publishListingPayloadSchema.safeParse(payloadCandidate);
  if (!publishParsed.success) {
    const classified = classifyValidationIssues(
      publishParsed.error.issues.map((i) => ({ code: i.code, path: i.path, received: (i as { received?: string }).received })),
    );
    return {
      ok: false,
      errors: {
        ...classified,
        unconfirmed,
      },
    };
  }

  if (unconfirmed.length) {
    return {
      ok: false,
      errors: {
        missing: [],
        invalid: [],
        unconfirmed,
      },
    };
  }

  return {
    ok: true,
    payload: publishParsed.data,
  };
}

