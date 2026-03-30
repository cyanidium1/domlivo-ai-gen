/**
 * Single source of truth for property intake vs Sanity `property` schema (see
 * `sanity-real-estate-query-contract.md`). Do not duplicate these lists elsewhere.
 */

/** Required on `property` in Studio / contract §2.1 — enforced at publish when wired to CMS. */
export const SCHEMA_REQUIRED_CORE_FIELDS = [
  "title",
  "slug",
  "agent",
  "type", // propertyType ref
  "status", // sale | rent | short-term (stored as `dealStatus` in session draft)
  "price",
  "city",
  "gallery",
] as const;

/** Optional on `property` per contract — may appear in draft / publish payload when set. */
export const SCHEMA_OPTIONAL_FIELDS = [
  "district",
  "shortDescription",
  "description",
  "address",
  "area",
  "bedrooms",
  "bathrooms",
  "yearBuilt",
  "amenitiesRefs", // draft key: `amenities`
  "propertyOffers",
  "seo",
  "locationTags",
  "coordinatesLat",
  "coordinatesLng",
  "propertyCode",
  "featured",
  "investment",
  "isPublished",
  "lifecycleStatus",
] as const;

/**
 * Not modeled as first-class scalars on `property` — do not persist as canonical property fields.
 * Map only via `amenitiesRefs` / `locationTags` when a deterministic Sanity match exists.
 */
export const UNSUPPORTED_DIRECT_PROPERTY_FIELDS = [
  "furnished",
  "hasElevator",
  "distanceToSeaMeters",
  "parkingSpots",
  "energyClass",
  "rooms",
  "currency",
  "countryCode",
] as const;

/** Reference-backed — must resolve to Sanity documents when catalogs are available. */
export const INDIRECT_TAXONOMY_FIELDS = [
  "city",
  "district",
  "propertyType",
  "amenity",
  "locationTag",
  "agent",
] as const;
