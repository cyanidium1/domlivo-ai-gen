import type { ListingDraft } from "@/lib/validation/listing-session";

export const CRITICAL_CONFIRMATION_FIELDS = [
  "internalRef",
  "status",
  "title",
  "slug",
  "description",
  "price",
  "dealStatus",
  "facts.propertyType",
  "facts.area",
  "address.city",
  "address.displayAddress",
  "gallery",
  "coverImage",
] as const;

export type CriticalConfirmationField = (typeof CRITICAL_CONFIRMATION_FIELDS)[number];
export type ConfirmationMap = Partial<Record<CriticalConfirmationField, boolean>>;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function toConfirmationMap(value: unknown): ConfirmationMap {
  const raw = asRecord(value);
  const map: ConfirmationMap = {};
  for (const field of CRITICAL_CONFIRMATION_FIELDS) {
    if (typeof raw[field] === "boolean") {
      map[field] = raw[field] as boolean;
    }
  }
  return map;
}

export function getConfirmation(sessionLike: { confirmation?: unknown } | null | undefined): ConfirmationMap {
  return toConfirmationMap(sessionLike?.confirmation);
}

export function setConfirmed(
  confirmation: ConfirmationMap | null | undefined,
  field: CriticalConfirmationField,
): ConfirmationMap {
  return {
    ...(confirmation ?? {}),
    [field]: true,
  };
}

export function unsetConfirmed(
  confirmation: ConfirmationMap | null | undefined,
  field: CriticalConfirmationField,
): ConfirmationMap {
  if (!confirmation) return {};
  const next = { ...confirmation };
  delete next[field];
  return next;
}

export function isConfirmed(
  confirmation: ConfirmationMap | null | undefined,
  field: CriticalConfirmationField,
): boolean {
  return Boolean(confirmation?.[field]);
}

export type CriticalFieldStatus = "missing" | "unconfirmed" | "confirmed";

export function getCriticalFieldStatus(
  draft: ListingDraft | null | undefined,
  field: CriticalConfirmationField,
  confirmation: ConfirmationMap | null | undefined,
): CriticalFieldStatus {
  const present = isCriticalFieldValuePresent(draft, field);
  if (!present) return "missing";
  if (isConfirmed(confirmation, field)) return "confirmed";
  return "unconfirmed";
}

export function isCriticalFieldValuePresent(draft: ListingDraft | null | undefined, field: CriticalConfirmationField): boolean {
  if (!draft) return false;
  switch (field) {
    case "internalRef":
      return typeof draft.internalRef === "string" && draft.internalRef.trim().length > 0;
    case "status":
      return typeof draft.status === "string" && draft.status.trim().length > 0;
    case "title":
      return Boolean(draft.title && Object.values(draft.title).some((v) => typeof v === "string" && v.trim().length > 0));
    case "slug":
      return typeof draft.slug?.current === "string" && draft.slug.current.trim().length > 0;
    case "description":
      return Boolean(
        draft.description && Object.values(draft.description).some((v) => typeof v === "string" && v.trim().length > 0),
      );
    case "price":
      return typeof draft.price === "number" && Number.isFinite(draft.price) && draft.price >= 0;
    case "dealStatus":
      return draft.dealStatus === "sale" || draft.dealStatus === "rent" || draft.dealStatus === "short-term";
    case "address.displayAddress":
      return Boolean(
        draft.address?.displayAddress &&
          Object.values(draft.address.displayAddress).some((v) => typeof v === "string" && v.trim().length > 0),
      );
    case "gallery":
      return Array.isArray(draft.gallery) && draft.gallery.length > 0;
    case "coverImage":
      return Boolean(draft.coverImage?.asset?._ref);
    default: {
      const value = getByPath(draft, field);
      if (typeof value === "string") return value.trim().length > 0;
      if (typeof value === "number") return Number.isFinite(value);
      return value !== undefined && value !== null;
    }
  }
}

function normalizeForComparison(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(normalizeForComparison);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeForComparison(v)]),
    );
  }
  return value;
}

function getComparableValue(draft: ListingDraft | null | undefined, field: CriticalConfirmationField): unknown {
  if (!draft) return undefined;
  switch (field) {
    case "title":
      return normalizeForComparison(draft.title);
    case "description":
      return normalizeForComparison(draft.description);
    case "address.displayAddress":
      return normalizeForComparison(draft.address?.displayAddress);
    case "gallery":
      return normalizeForComparison(
        (draft.gallery ?? []).map((g) => ({
          ref: g.image.asset._ref,
          alt: typeof g.alt === "string" ? g.alt : (g.alt as { en?: string } | undefined)?.en,
          sortOrder: g.sortOrder,
        })),
      );
    default:
      return normalizeForComparison(getByPath(draft, field));
  }
}

export function invalidateConfirmationOnDraftChange(
  previousDraft: ListingDraft | null | undefined,
  nextDraft: ListingDraft | null | undefined,
  confirmation: ConfirmationMap | null | undefined,
): ConfirmationMap {
  const base = { ...(confirmation ?? {}) };
  const next = { ...base };
  for (const field of CRITICAL_CONFIRMATION_FIELDS) {
    if (!next[field]) continue;
    const before = getComparableValue(previousDraft, field);
    const after = getComparableValue(nextDraft, field);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      delete next[field];
    }
  }
  return next;
}

export function getUnconfirmedCriticalFields(
  draft: ListingDraft | null | undefined,
  confirmation: ConfirmationMap | null | undefined,
): CriticalConfirmationField[] {
  return CRITICAL_CONFIRMATION_FIELDS.filter((field) => !(isConfirmed(confirmation, field) && isCriticalFieldValuePresent(draft, field)));
}

