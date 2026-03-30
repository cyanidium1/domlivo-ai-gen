/**
 * Allowlist for `propertyOffer.iconKey` (and amenity icons) — mirrors Studio
 * `schemaTypes/constants/iconOptions.ts` conceptually. Keep in sync with Sanity.
 */
export const PROPERTY_ICON_KEYS = [
  "wifi",
  "parking",
  "elevator",
  "sea-view",
  "mountain-view",
  "balcony",
  "terrace",
  "garden",
  "pool",
  "air-conditioning",
  "heating",
  "fireplace",
  "security",
  "furnished",
  "kitchen",
  "washing-machine",
  "dishwasher",
  "pet-friendly",
  "wheelchair",
  "storage",
  "alarm",
] as const;

export type PropertyIconKey = (typeof PROPERTY_ICON_KEYS)[number];

export function isAllowedPropertyOfferIconKey(key: string | undefined | null): key is PropertyIconKey {
  if (!key || typeof key !== "string") return false;
  return (PROPERTY_ICON_KEYS as readonly string[]).includes(key);
}
