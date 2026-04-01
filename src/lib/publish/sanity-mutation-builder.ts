import "server-only";

import type { PublishListingPayload } from "@/lib/validation/listing-session";

// ---------------------------------------------------------------------------
// MVP lifecycle defaults
// Properties created via ingestion start as editor-review drafts.
// The editor promotes them to active + isPublished=true in Sanity Studio.
// ---------------------------------------------------------------------------
export const MVP_LIFECYCLE_STATUS = "draft" as const;
export const MVP_IS_PUBLISHED = false as const;

// ---------------------------------------------------------------------------
// Sanity document shape
// Matches schemaTypes/documents/property.ts in domlivo-admin exactly.
// Fields are named to match Sanity, NOT the ingestion payload.
// ---------------------------------------------------------------------------

type SanityRef = { _type: "reference"; _ref: string };
type SanitySlug = { _type: "slug"; current: string };
type SanityImage = { _type: "image"; asset: SanityRef };
type LocalizedString = Partial<Record<"en" | "uk" | "ru" | "sq" | "it", string | undefined>>;

type SanityGalleryItem = {
  _type: "image";
  _key: string;
  asset: SanityRef;
  alt: string;
  label?: string;
};

type SanityPropertyOfferItem = {
  _key: string;
  title: LocalizedString;
  iconKey?: string;
};

type SanityRefArrayItem = SanityRef & { _key: string };

type SanityPropertySeo = {
  metaTitle?: LocalizedString;
  metaDescription?: LocalizedString;
  canonicalUrl?: string;
  noIndex?: boolean;
  ogImage?: SanityImage;
};

/**
 * The exact shape written to Sanity via createOrReplace.
 * Mirrors property.ts in domlivo-admin — field names must not diverge.
 */
export type SanityPropertyDocument = {
  _type: "property";

  // Basic — required by Sanity schema
  title: LocalizedString;
  slug: SanitySlug;
  agent: SanityRef;
  /** Maps from ingestion `type` ref (propertyType document). */
  type: SanityRef;
  /** Maps from ingestion `dealStatus`. */
  status: "sale" | "rent" | "short-term";
  price: number;
  /** MVP default: false — editor publishes manually in Studio. */
  isPublished: boolean;
  /**
   * MVP default: "draft" — ingestion always creates as draft.
   * Maps from ingestion `status` (editorial workflow) loosely;
   * the editor promotes to active/reserved/sold as appropriate.
   */
  lifecycleStatus: "draft" | "active" | "reserved" | "sold" | "rented" | "archived";
  /** Required by Sanity, min 1. coverImage ordering applied before building. */
  gallery: SanityGalleryItem[];

  // Optional basic
  shortDescription?: LocalizedString;
  description?: LocalizedString;
  featured: boolean;
  investment: boolean;

  // Location
  city?: SanityRef;
  district?: SanityRef;
  /** Maps from ingestion `address.displayAddress` (localizedString). */
  address?: LocalizedString;
  /** Maps from ingestion `address.location.lat`. */
  coordinatesLat?: number;
  /** Maps from ingestion `address.location.lng`. */
  coordinatesLng?: number;
  locationTags?: SanityRefArrayItem[];

  // Details
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  /** Maps from ingestion `amenities` (field rename). */
  amenitiesRefs?: SanityRefArrayItem[];
  propertyOffers?: SanityPropertyOfferItem[];
  /** Maps from ingestion `internalRef` (field rename). */
  propertyCode?: string;

  // SEO — subset of localizedSeo; unprovided fields default to undefined in Studio
  seo?: SanityPropertySeo;

  createdAt: string;
};

// ---------------------------------------------------------------------------
// Error thrown when the payload is missing a Sanity-required field
// ---------------------------------------------------------------------------
export class MutationBuilderError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(`[sanity-mutation-builder] ${message}`);
    this.name = "MutationBuilderError";
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sanityRef(id: string): SanityRef {
  return { _type: "reference", _ref: id };
}

/**
 * Stable, deterministic key derived from a Sanity asset _ref.
 * Sanity requires a `_key` on every array item.
 * Using the ref directly is idempotent across re-publishes.
 * Falls back to index-based key if ref is somehow absent.
 */
function keyFromRef(ref: string, index: number): string {
  // Sanity _ref format: "image-<hash>-<width>x<height>-<format>"
  // Taking the first 16 chars of the hash portion gives a stable short key.
  const parts = ref.replace(/^image-/, "").split("-");
  const hash = parts[0] ?? "";
  const key = hash.length >= 8 ? hash.slice(0, 16) : `item${index}`;
  return key;
}

/**
 * Reorder gallery so the item matching `coverRef` is first.
 * `coverImage` is an ingestion-only concept; it must NOT be written to Sanity.
 * The frontend uses gallery[0] as the cover.
 */
function orderGalleryByCover(
  gallery: PublishListingPayload["gallery"],
  coverRef: string | undefined,
): PublishListingPayload["gallery"] {
  if (!coverRef || !gallery.length) return gallery;
  const coverIndex = gallery.findIndex((item) => item.image.asset._ref === coverRef);
  if (coverIndex <= 0) return gallery;
  const reordered = [...gallery];
  const [cover] = reordered.splice(coverIndex, 1);
  reordered.unshift(cover);
  return reordered;
}

function buildGalleryItems(
  gallery: PublishListingPayload["gallery"],
  coverRef: string | undefined,
): SanityGalleryItem[] {
  const ordered = orderGalleryByCover(gallery, coverRef);
  return ordered.map((item, index) => {
    const key = keyFromRef(item.image.asset._ref, index);
    const label =
      item.caption && typeof item.caption === "object"
        ? (item.caption.en ?? undefined)
        : undefined;
    return {
      _type: "image",
      _key: key,
      asset: sanityRef(item.image.asset._ref),
      alt: typeof item.alt === "string" ? item.alt : "",
      ...(label ? { label } : {}),
    };
  });
}

function buildRefArray(
  refs: Array<{ _type: "reference"; _ref: string; _weak?: boolean }> | undefined,
): SanityRefArrayItem[] | undefined {
  if (!refs?.length) return undefined;
  return refs.map((r, i) => ({
    _type: "reference",
    _ref: r._ref,
    _key: keyFromRef(r._ref, i),
  }));
}

function buildPropertyOffers(
  offers: PublishListingPayload["propertyOffers"],
): SanityPropertyOfferItem[] | undefined {
  if (!offers?.length) return undefined;
  return offers.map((offer, i) => ({
    _key: `offer${i}`,
    title: offer.title,
    ...(offer.iconKey ? { iconKey: offer.iconKey } : {}),
  }));
}

function buildSeo(seo: PublishListingPayload["seo"]): SanityPropertySeo | undefined {
  if (!seo) return undefined;
  const out: SanityPropertySeo = {};
  if (seo.metaTitle) out.metaTitle = seo.metaTitle;
  if (seo.metaDescription) out.metaDescription = seo.metaDescription;
  if (seo.canonicalUrl) out.canonicalUrl = seo.canonicalUrl;
  if (typeof seo.noIndex === "boolean") out.noIndex = seo.noIndex;
  if (seo.ogImage) out.ogImage = seo.ogImage;
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Maps a validated `PublishListingPayload` to the exact Sanity `property`
 * document shape for use in a `createOrReplace` mutation.
 *
 * This function is the single adapter between the ingestion domain model and
 * the Sanity schema. All field renames, type transforms, and drops are here.
 *
 * Throws `MutationBuilderError` if a Sanity-required ref is missing (non-draft mode).
 *
 * Does NOT upload images. Gallery items must already have real Sanity asset
 * `_ref` values before calling this function.
 */
export function buildSanityPropertyMutation(
  payload: PublishListingPayload,
  options?: { defaultAgentId?: string; mode?: "draft" | "property" },
): SanityPropertyDocument {
  const isDraft = options?.mode === "draft";
  const agentRef = payload.sanityAgentRef ?? options?.defaultAgentId;

  // ------------------------------------------------------------------
  // Required Sanity refs — these must be present for a valid document.
  // Both are Sanity-required fields (agent, type) that are optional in
  // the ingestion draft but enforced here at the mutation boundary.
  // In draft mode, missing refs are tolerated (Sanity draft can be
  // saved without all refs and filled in by the editor).
  // ------------------------------------------------------------------
  if (!agentRef && !isDraft) {
    throw new MutationBuilderError(
      "agent",
      "sanityAgentRef is required to publish. Resolve an agent via intake or set a default agent.",
    );
  }
  if (!payload.sanityPropertyTypeRef && !isDraft) {
    throw new MutationBuilderError(
      "type",
      "sanityPropertyTypeRef is required to publish. Resolve propertyType during intake.",
    );
  }

  const coverRef = payload.coverImage?.asset?._ref;

  const doc: SanityPropertyDocument = {
    _type: "property",

    // ── Basic ─────────────────────────────────────────────────────────────
    title: payload.title,
    slug: { _type: "slug", current: payload.slug.current },

    // agent._ref ← agentRef (from payload or default)
    // In draft mode without an agent ref, fall back to a placeholder string
    // that the editor can correct in Studio.
    agent: sanityRef(agentRef ?? "unknown-agent"),

    // type._ref ← sanityPropertyTypeRef (Sanity field name: `type`)
    type: sanityRef(payload.sanityPropertyTypeRef ?? "unknown-type"),

    // status ← dealStatus (value enum is identical: sale|rent|short-term)
    status: payload.dealStatus,

    price: payload.price,

    // MVP lifecycle defaults — editor promotes in Studio
    isPublished: MVP_IS_PUBLISHED,
    lifecycleStatus: MVP_LIFECYCLE_STATUS,

    // ── Optional basic ────────────────────────────────────────────────────
    ...(payload.shortDescription ? { shortDescription: payload.shortDescription } : {}),
    ...(payload.description ? { description: payload.description } : {}),

    featured: false,
    investment: false,

    // ── Location ─────────────────────────────────────────────────────────
    ...(payload.sanityCityRef ? { city: sanityRef(payload.sanityCityRef) } : {}),
    ...(payload.sanityDistrictRef ? { district: sanityRef(payload.sanityDistrictRef) } : {}),

    // address ← address.displayAddress (localizedString → localizedString)
    // The complex ingestion address object collapses to Sanity's single
    // localizedString address field. Structured sub-fields (streetLine,
    // postalCode, countryCode) have no Sanity schema counterpart.
    ...(payload.address?.displayAddress
      ? { address: payload.address.displayAddress }
      : {}),

    // coordinatesLat/Lng ← address.location.lat/lng
    // Sanity stores as separate top-level scalars, not a nested geopoint.
    ...(payload.address?.location?.lat !== undefined
      ? { coordinatesLat: payload.address.location.lat }
      : {}),
    ...(payload.address?.location?.lng !== undefined
      ? { coordinatesLng: payload.address.location.lng }
      : {}),

    // locationTags — field name matches; add _key per Sanity array requirement
    ...(payload.locationTags?.length
      ? { locationTags: buildRefArray(payload.locationTags) }
      : {}),

    // ── Details ───────────────────────────────────────────────────────────
    ...(payload.facts.area !== undefined ? { area: payload.facts.area } : {}),
    ...(payload.facts.bedrooms !== undefined ? { bedrooms: payload.facts.bedrooms } : {}),
    ...(payload.facts.bathrooms !== undefined ? { bathrooms: payload.facts.bathrooms } : {}),
    ...(payload.facts.yearBuilt !== undefined ? { yearBuilt: payload.facts.yearBuilt } : {}),

    // amenitiesRefs ← amenities (field rename; values are reference objects)
    ...(payload.amenities?.length
      ? { amenitiesRefs: buildRefArray(payload.amenities) }
      : {}),

    ...(payload.propertyOffers?.length
      ? { propertyOffers: buildPropertyOffers(payload.propertyOffers) }
      : {}),

    // propertyCode ← internalRef (field rename)
    ...(payload.internalRef ? { propertyCode: payload.internalRef } : {}),

    // ── Media ─────────────────────────────────────────────────────────────
    // coverImage is NOT written to Sanity — no such field exists on property.
    // Instead, the item matching coverImage._ref is moved to gallery[0].
    // gallery caption.en → label (Sanity gallery items have label: string).
    // Fields dropped: roomType, sortOrder, aiGeneratedDescription.
    gallery: buildGalleryItems(payload.gallery, coverRef),

    // ── SEO ───────────────────────────────────────────────────────────────
    // Ingestion seo is a structural subset of Sanity localizedSeo.
    // Missing fields (keywords, ogTitle, ogDescription, twitter*) default
    // to undefined in Studio and can be filled by editors.
    ...(buildSeo(payload.seo) ? { seo: buildSeo(payload.seo) } : {}),

    // ── Analytics ────────────────────────────────────────────────────────
    createdAt: new Date().toISOString(),
  };

  return doc;
}
