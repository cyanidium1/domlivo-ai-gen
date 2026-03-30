# Sanity Mutation Builder — Implementation Report

**Date:** 2026-03-28
**Task:** MVP publish task 1 — field mapping layer only. No image upload. No publisher call.

---

## 1. Summary

Created `src/lib/publish/sanity-mutation-builder.ts`. This is the single adapter between the ingestion `PublishListingPayload` and the exact Sanity `property` document shape required by `domlivo-admin/schemaTypes/documents/property.ts`.

Also tightened `publishListingPayloadSchema` in `src/lib/validation/listing-session.ts` to make `sanityPropertyTypeRef` and `sanityAgentRef` required (both are required fields in the Sanity schema; they were previously optional in the ingestion publish gate).

`src/lib/sanity/publish-listing.ts` (existing stub) was **not modified** — it spreads the raw payload with `_type: "propertyListing"` (wrong type) and has no field mapping. It should be removed or replaced when `SanityListingPublisher` is implemented.

TypeScript: `tsc --noEmit` passes with zero errors after both changes.

---

## 2. Field Mapping Implemented

| Ingestion field | Sanity field | Transform |
|---|---|---|
| `dealStatus` | `status` | direct — enum values are identical |
| `internalRef` | `propertyCode` | rename |
| `amenities[]` | `amenitiesRefs[]` | rename + add `_key` per array item |
| `sanityPropertyTypeRef` | `type` | wrap as `{_type:"reference", _ref}` |
| `sanityAgentRef` | `agent` | wrap as `{_type:"reference", _ref}` |
| `sanityCityRef` | `city` | wrap as `{_type:"reference", _ref}` |
| `sanityDistrictRef` | `district` | wrap as `{_type:"reference", _ref}` |
| `locationTags[]` | `locationTags[]` | add `_key` per item (values already correct) |
| `slug.current` | `slug` | wrap as `{_type:"slug", current}` |
| `address.displayAddress` | `address` | pass localizedString directly |
| `address.location.lat` | `coordinatesLat` | extract from nested geopoint |
| `address.location.lng` | `coordinatesLng` | extract from nested geopoint |
| `gallery[i].image.asset._ref` | `gallery[i].asset._ref` | unwrap `image` wrapper |
| `gallery[i].caption?.en` | `gallery[i].label` | extract English locale only |
| `gallery[i].alt` | `gallery[i].alt` | direct |
| `coverImage` | (gallery ordering only) | move matching item to `gallery[0]`; not written to Sanity |
| `facts.area` | `area` | promote from nested `facts` object |
| `facts.bedrooms` | `bedrooms` | promote from nested `facts` object |
| `facts.bathrooms` | `bathrooms` | promote from nested `facts` object |
| `facts.yearBuilt` | `yearBuilt` | promote from nested `facts` object |
| `propertyOffers[]` | `propertyOffers[]` | add `_key` per item |
| `seo.metaTitle` | `seo.metaTitle` | direct (localizedString) |
| `seo.metaDescription` | `seo.metaDescription` | direct (localizedText) |
| `seo.canonicalUrl` | `seo.canonicalUrl` | direct |
| `seo.noIndex` | `seo.noIndex` | direct |
| `seo.ogImage` | `seo.ogImage` | direct (SanityImage shape) |
| `title` | `title` | direct (localizedString) |
| `description` | `description` | direct (localizedText) |
| `shortDescription` | `shortDescription` | direct (localizedText) |
| `price` | `price` | direct (EUR number) |

---

## 3. Fields Intentionally Dropped

| Ingestion field | Reason |
|---|---|
| `coverImage` | No Sanity field. Used only to reorder gallery so the cover is `gallery[0]`. |
| `status` (editorial: draft/in_review/published/archived) | No direct Sanity counterpart. MVP lifecycle is hardcoded (see section 5). |
| `gallery[i].roomType` | No Sanity gallery schema field. |
| `gallery[i].sortOrder` | No Sanity gallery schema field. sortOrder is expressed via array position. |
| `gallery[i].aiGeneratedDescription` | No Sanity gallery schema field. |
| `gallery[i].caption.uk/ru/sq/it` | Sanity `label` is a plain `string`. Only `caption.en` is mapped. |
| `address.city` | No Sanity structured address sub-fields. City is expressed via `city` reference. |
| `address.district` | Same — expressed via `district` reference. |
| `address.streetLine` | No Sanity scalar field for this. No schema counterpart. |
| `address.postalCode` | No Sanity scalar field for this. |
| `address.countryCode` | No Sanity scalar field for this. |
| `address.hideExactLocation` | No Sanity scalar field for this. |
| `ai` (metadata block) | Not a Sanity property field. Stays in ingestion Postgres only. |
| `publishedAt` | Not a Sanity property field. |
| `sourceSessionId` | Not a Sanity property field. |
| `seo.keywords` | Supported in Sanity `localizedSeo` but not in ingestion seo schema. Left for editor to fill in Studio. |
| `seo.ogTitle/ogDescription` | Same — in `localizedSeo` but not in ingestion seo schema. |
| `seo.twitterTitle/twitterDescription` | Same. |
| `seo.noFollow` | Same. |

---

## 4. Required Publish Inputs

The following must be present for `buildSanityPropertyMutation` to succeed. It throws `MutationBuilderError` with a clear field name and message if either ref is missing.

| Field | Source | Why required |
|---|---|---|
| `sanityAgentRef` | resolved during intake via `applyReferenceResolutionToFacts` | Sanity `property.agent` is required |
| `sanityPropertyTypeRef` | resolved during intake via `applyReferenceResolutionToFacts` | Sanity `property.type` is required |
| `title` | AI generation | Sanity required |
| `slug.current` | draft mapper | Sanity required |
| `dealStatus` | intake | maps to Sanity `status` (required) |
| `price` | intake | Sanity required (min 0) |
| `gallery` (min 1) | user upload | Sanity required |
| `internalRef` | user/agent input | maps to `propertyCode` |
| `facts.propertyType`, `facts.area` | intake | required by `propertyFactsPublishSchema` |

Additionally, `sanityCityRef` and `sanityDistrictRef` are optional in the schema but the city ref is effectively required by the Sanity `property.city` validation rule. The mutation builder writes city/district refs if present; the Sanity write will fail server-side if city is absent.

---

## 5. Defaults Chosen for MVP

| Sanity field | MVP value | Rationale |
|---|---|---|
| `lifecycleStatus` | `"draft"` | New AI-ingested properties start as drafts. Editor reviews and promotes to `"active"` in Studio before listing goes live. |
| `isPublished` | `false` | Property is not visible on the website until an editor explicitly publishes it. Prevents accidental exposure of incomplete AI-generated listings. |
| `featured` | `false` | Not featured by default. Editor sets manually. |
| `investment` | `false` | Not an investment listing by default. Editor sets manually. |
| `createdAt` | `new Date().toISOString()` | Set at mutation build time (Sanity `initialValue` would not fire on API writes). |

These defaults are exported as named constants (`MVP_LIFECYCLE_STATUS`, `MVP_IS_PUBLISHED`) from the builder file so they can be changed in one place if the MVP policy changes.

---

## 6. Files Changed

| File | Change |
|---|---|
| `src/lib/publish/sanity-mutation-builder.ts` | **Created.** Full field adapter. Exports `buildSanityPropertyMutation`, `SanityPropertyDocument`, `MutationBuilderError`, `MVP_LIFECYCLE_STATUS`, `MVP_IS_PUBLISHED`. |
| `src/lib/validation/listing-session.ts` | **Modified.** In `publishListingPayloadSchema`: `sanityPropertyTypeRef` and `sanityAgentRef` promoted from `.optional()` to required with doc comments. |

### Files NOT changed (intentional)

| File | Why not changed |
|---|---|
| `src/lib/publish/providers/sanity-listing-publisher.ts` | Still a stub. Publisher is the next task after image upload is solved. |
| `src/lib/sanity/publish-listing.ts` | Old stub with wrong `_type: "propertyListing"`. Left in place — do not use. Will be superseded by the publisher implementation. |
| `src/lib/listing-session/field-requirements.ts` | `PUBLISH_OPTIONAL_PATHS` still lists `sanityPropertyTypeRef` and `sanityAgentRef`. Should be updated to `PUBLISH_REQUIRED_PATHS` in a follow-up to keep the field requirements file in sync. |
| UI components | Not touched per task scope. |

---

## 7. Remaining Blockers

These must be resolved before a real end-to-end publish can succeed.

### B1 — Image asset upload (immediate next task)
Gallery items currently hold temporary storage keys, not Sanity asset `_ref` values. Before `buildSanityPropertyMutation` is called, every gallery image must be uploaded to the Sanity Assets API (`/assets/images/{projectId}/{dataset}`) and its response `_ref` must replace the temp key in the gallery array.

Without this, the mutation builder will produce a document with invalid asset refs that Sanity will reject.

### B2 — `SanityListingPublisher` implementation
After B1, `SanityListingPublisher.publish()` must:
1. Upload images (B1)
2. Call `buildSanityPropertyMutation(payload)`
3. Call `client.createOrReplace(doc)` with a deterministic `_id` (e.g. `"property-{sessionId}"`)
4. Return the `sanityDocumentId`

### B3 — `sanityCityRef` must be present for Sanity to accept the document
Sanity `property.city` is required. The mutation builder writes city as a ref if present, but the `publishListingPayloadSchema` still marks `sanityCityRef` as optional. If a session reaches publish without a resolved city ref, the Sanity write will fail with a validation error.

Options: promote `sanityCityRef` to required in `publishListingPayloadSchema`, or add it to the `buildSanityPropertyMutation` guard alongside agent and type.

### B4 — `field-requirements.ts` out of sync
`PUBLISH_OPTIONAL_PATHS` in `src/lib/listing-session/field-requirements.ts` still lists `sanityPropertyTypeRef` and `sanityAgentRef` as optional. Now that they are required in `publishListingPayloadSchema`, this file should be updated to match.

### B5 — `src/lib/sanity/publish-listing.ts` is a live hazard
It spreads the raw ingestion payload with `_type: "propertyListing"` (wrong type name). If anything ever calls it instead of the new builder, it will silently create a malformed Sanity document. Should be deleted when `SanityListingPublisher` is implemented.

### B6 — `internalRef` generation undefined
`publishListingPayloadSchema` requires `internalRef` (which maps to `propertyCode`). Nothing in the ingestion tool auto-generates it. The agent must manually enter it, or the draft mapper must auto-generate it (e.g. from session ID prefix). This is a UX gap that will cause the publish gate to block every session.
