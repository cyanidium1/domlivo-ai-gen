# Full Architecture Review — Domlivo AI-Gen ↔ Domlivo Admin

**Date:** 2026-03-28
**Repos reviewed:** `domlivo-ai-gen` (ingestion tool) + `domlivo-admin` (Sanity CMS)
**Reviewer role:** Senior staff architect
**Status:** Pre-publish review — NO code was changed

---

## 1. Executive Summary

The ingestion tool and Sanity CMS are **partially aligned but not publish-ready**. The reference-data pipeline, confirmation gate, and provider pattern are well-designed. However, the publish layer has **never been implemented** (`SanityListingPublisher` throws `notImplemented`), and there are **at least 10 concrete field-level mismatches** between `publishListingPayloadSchema` and the actual Sanity `property` schema. Publishing a listing today would silently write the wrong shape to Sanity or fail on required fields.

The single biggest blocker is: **`SanityListingPublisher` is a stub. It must be implemented using the actual Sanity field names, not the ingestion draft field names — and these differ in 10+ places.**

---

## 2. Sanity Repo Audit

**Repo:** `C:/Users/User/Documents/GitHub/domlivo-admin/`

### 2.1 Property Schema Contract

**File:** `schemaTypes/documents/property.ts`

| Sanity field | Type | Required |
|---|---|---|
| `title` | `localizedString` | YES |
| `slug` | `slug` (`{_type:"slug", current}`) | YES |
| `agent` | reference → `agent` | YES |
| `type` | reference → `propertyType` | YES |
| `status` | string enum: `sale\|rent\|short-term` | YES |
| `price` | number (EUR) | YES (min 0) |
| `city` | reference → `city` | YES |
| `gallery` | array of `{image, alt, label}` | YES (min 1, max 30) |
| `isPublished` | boolean | NO (default true) |
| `lifecycleStatus` | string enum: `draft\|active\|reserved\|sold\|rented\|archived` | NO (default active) |
| `shortDescription` | `localizedText` | NO |
| `description` | `localizedText` | NO |
| `district` | reference → `district` | NO |
| `address` | `localizedString` | NO |
| `coordinatesLat` | number | NO |
| `coordinatesLng` | number | NO |
| `locationTags` | array of reference → `locationTag` | NO |
| `area` | number | NO |
| `bedrooms` | number | NO |
| `bathrooms` | number | NO |
| `yearBuilt` | number | NO |
| `amenitiesRefs` | array of reference → `amenity` | NO |
| `propertyOffers` | array of `propertyOffer` objects | NO |
| `propertyCode` | string | NO |
| `seo` | `localizedSeo` | NO |

### 2.2 Reference Dictionaries

All confirmed present in `schemaTypes/documents/`:

| Type | Sanity `_type` | Required fields |
|---|---|---|
| City | `city` | `title` (localized), `slug` |
| District | `district` | `title`, `slug`, `city` (ref) |
| PropertyType | `propertyType` | `title` (localized), `slug` |
| Amenity | `amenity` | `title` (localized), `slug` |
| LocationTag | `locationTag` | `title` (localized), `slug` |
| Agent | `agent` | `name`, `email` |

### 2.3 `propertyOffer` — embedded object, not a document

**File:** `schemaTypes/objects/propertyOffer.ts`
`propertyOffers` are **embedded objects on `property`**, not a CMS taxonomy/document. Each offer has:
- `title` (`localizedString`) — required per item
- `iconKey` — optional, must be from `PROPERTY_ICON_KEYS` if set
- `customIcon` — optional image upload

There is NO `propertyOffer` document type. The ingestion tool correctly identifies this.

### 2.4 Gallery Schema (Sanity)

**File:** `schemaTypes/documents/property.ts` lines 292–316

Each gallery item is an inline image with two extra fields:
- `alt` — `string` (plain, not localized)
- `label` — `string` (plain string caption, not localized)

No `roomType`, no `sortOrder`, no `aiGeneratedDescription`, no `caption`. Gallery `required`, min 1, max 30.

### 2.5 `localizedSeo` Schema (Sanity)

**File:** `schemaTypes/objects/localizedSeo.ts` (confirmed via query contract doc)

Full structure per locale: `metaTitle`, `metaDescription`, `keywords`, `ogTitle`, `ogDescription`, `twitterTitle`, `twitterDescription`, `ogImage` (single image), `canonicalUrl`, `noIndex`, `noFollow`.

### 2.6 `address` Field (Sanity)

**File:** `schemaTypes/documents/property.ts` line 183
`address` is type `localizedString` — a simple per-locale text string. Not a structured object.

### 2.7 Coordinates (Sanity)

**File:** `schemaTypes/documents/property.ts` lines 193–208
`coordinatesLat` and `coordinatesLng` are **separate top-level number fields** on the property document. Not nested under address. Not a geopoint object.

### 2.8 Fields NOT modeled in Sanity schema

The following are NOT scalar fields on `property`:
- `furnished` (NOT FOUND as scalar)
- `elevator` (NOT FOUND as scalar)
- `distanceToSeaMeters` (NOT FOUND as scalar)
- `parkingSpots` (NOT FOUND as scalar)
- `energyClass` (NOT FOUND as scalar)
- `rooms` / `roomCount` (NOT FOUND as scalar)
- `coverImage` (NOT FOUND — gallery[0] is the de-facto cover)
- `internalRef` (NOT FOUND — `propertyCode` is the closest field)

These live in `intakeHints` in extracted facts, which is correct.

### 2.9 Validation Rules That Matter for Ingestion

- `agent` reference: **required** — will fail server-side if missing
- `type` reference (propertyType): **required** — will fail server-side if missing
- `city` reference: **required** — will fail server-side if missing
- `gallery` min 1: **required** — will fail server-side if empty
- `slug`: **required** — must be `{_type:"slug", current: string}`
- `amenitiesRefs` must be unique

---

## 3. Ingestion Repo Audit

**Repo:** `C:/Users/User/Documents/GitHub/domlivo-ai-gen/`

### 3.1 Domain Model

**File:** `src/lib/validation/listing-session.ts`

Core type `ListingDraft` (lines 372–426) contains:
- `internalRef` — optional string (publish requires it)
- `status` — `"draft" | "in_review" | "published" | "archived"` (editorial workflow concept)
- `title` — `localizedStringSchema`
- `slug` — `{current: string}` (note: missing `_type: "slug"`)
- `shortDescription` — `localizedTextSchema`
- `description` — `localizedTextSchema`
- `price` — EUR number (with legacy `{amount, currency}` preprocess)
- `dealStatus` — `"sale" | "rent" | "short-term"`
- `facts` — `{propertyType, area, bedrooms, bathrooms, yearBuilt}` (strings/numbers)
- `address` — complex object: `{countryCode, city, district, streetLine, postalCode, displayAddress (localized), location (geopoint), hideExactLocation}`
- `sanityCityRef`, `sanityDistrictRef`, `sanityPropertyTypeRef`, `sanityAgentRef` — optional strings
- `amenities` — array of `{_type:"reference", _ref}`
- `locationTags` — array of `{_type:"reference", _ref}`
- `propertyOffers` — array of `{title (localizedString), iconKey?}`
- `gallery` — array of `{image, caption (localized optional), alt, roomType?, sortOrder?, aiGeneratedDescription?}`
- `coverImage` — `{_type:"image", asset:{_type:"reference", _ref}}`
- `seo` — flat `{metaTitle (localized), metaDescription (localized), canonicalUrl, noIndex, ogImage}`
- `ai` — metadata block

**File:** `src/lib/validation/extracted-facts.ts`

`ExtractedFacts` fields: `price`, `area`, `areaTotal` (legacy), `bedrooms`, `bathrooms`, `yearBuilt`, `city`, `displayAddress`, `district`, `streetLine`, `postalCode`, `propertyType`, `dealStatus`, `dealType` (legacy), `sanityCityRef`, `sanityDistrictRef`, `sanityPropertyTypeRef`, `intakeHints`.

`intakeHints` correctly captures non-schema data (elevator, furnished, distanceToSea, etc.)

### 3.2 Intake Flow

**File:** `src/lib/listing-session/service.ts`

1. `analyzeListingIntake` → transcribe audio → regex extraction (`src/lib/extraction/extract-facts.ts`) → merge → OpenAI semantic extraction (`src/lib/intake/openai-intake-analyzer.ts`) → reference resolution (`src/lib/sanity/reference-data.ts:applyReferenceResolutionToFacts`) → `IntakeAnalysis` with missing/optional/questions
2. Facts are Zod-validated at each step via `extractedFactsSchema`
3. Reference resolution: city + propertyType mismatch = `blocksIntake: true`

### 3.3 AI Generation

**File:** `src/lib/ai/providers/openai-draft-generator.ts`
Model: `gpt-4o-mini` via `DRAFT_OPENAI_MODEL` env.
Uses JSON mode with `listingDraftJsonSchema`.
Prompt includes Sanity reference data context via `formatReferenceContextForPrompt`.
Fallback: `src/lib/ai/providers/stub-draft-generator.ts` always succeeds.

**File:** `src/lib/intake/prompt-templates.ts`
Prompt explicitly forbids AI from inventing: `furnished`, `elevator`, `distanceToSeaMeters`, `parkingSpots`, `energyClass`, combined rooms. These must go to `intakeHints` only.

### 3.4 Confirmation Gate

**File:** `src/lib/listing-session/confirmation.ts`

13 critical fields tracked: `internalRef`, `status`, `title`, `slug`, `description`, `price`, `dealStatus`, `facts.propertyType`, `facts.area`, `address.city`, `address.displayAddress`, `gallery`, `coverImage`.

Confirmation invalidated on draft change. Well-designed gate. **Problem:** `status` in this list is the ingestion editorial status ("draft"|"in_review"), not a Sanity field.

### 3.5 Publish Payload

**File:** `src/lib/listing-session/publish-payload.ts`

`buildPublishPayload` validates `editedDraft` against `listingDraftSchema`, then `publishListingPayloadSchema`. Checks unconfirmed fields. Checks `coverImage` is in gallery.

**File:** `src/lib/validation/listing-session.ts` lines 430–482

`publishListingPayloadSchema` requires: `internalRef`, `status`, `title`, `slug`, `description`, `price`, `dealStatus`, `facts` (with required `propertyType`, `area`), `gallery` (min 1), `coverImage`. Optional: `sanityCityRef`, `sanityDistrictRef`, `sanityPropertyTypeRef`, `sanityAgentRef`, `amenities`, `locationTags`, `propertyOffers`, `seo`.

### 3.6 Publish Implementation

**File:** `src/lib/publish/providers/sanity-listing-publisher.ts`

```ts
async publish(_: PublishListingInput): Promise<PublishListingResult> {
  throw notImplemented("SanityListingPublisher is not implemented yet.");
}
```

**The entire publish pipeline is a stub. No Sanity mutations are written anywhere.**

### 3.7 Reference-Data Queries (Ingestion → Sanity)

**File:** `src/lib/sanity/reference-data.ts`

6 GROQ queries run at intake time:
- `cityQuery` — fetches `_id`, `title`, `slug.current`
- `districtQuery` — fetches `_id`, `title`, `slug.current`, `city._ref`
- `propertyTypeQuery` — fetches `_id`, `title`, `slug.current`
- `amenityQuery` — fetches `_id`, `title`, `slug.current`
- `locationTagQuery` — fetches `_id`, `title`, `slug.current`
- `agentsQuery` — fetches `_id`, `name`, `email`

These queries are correct and match the Sanity schema.

### 3.8 Field Requirements

**File:** `src/lib/listing-session/field-requirements.ts`

Intake required: `price`, `dealStatus`, `city`, `propertyType`, `area`, `photo`
Publish required: `internalRef`, `status`, `title`, `description`, `price`, `dealStatus`, `facts`, `gallery`, `coverImage`
Publish optional (including): `sanityCityRef`, `sanityDistrictRef`, `sanityPropertyTypeRef`, `sanityAgentRef`

**Problem:** `sanityPropertyTypeRef` and `sanityAgentRef` are optional in the publish gate, but Sanity requires `type` and `agent` references.

---

## 4. Cross-Repo Contract Mismatches

This is the most important section. All mismatches are concrete and file-referenced.

---

### MISMATCH 1 — `address` type (CRITICAL)

| Side | File | Field | Type |
|---|---|---|---|
| Sanity | `property.ts:183` | `address` | `localizedString` (per-locale plain text) |
| Ingestion | `listing-session.ts:111` | `address` | complex object `{countryCode, city, district, streetLine, postalCode, displayAddress, location, hideExactLocation}` |

**Impact:** The ingestion `address` object cannot be written to Sanity as-is. The publisher must map `address.displayAddress` → Sanity `address` (localizedString), and discard or remap `countryCode`, `city`, `district`, `streetLine`, `postalCode`.

---

### MISMATCH 2 — Coordinates (CRITICAL)

| Side | File | Field | Type |
|---|---|---|---|
| Sanity | `property.ts:193–208` | `coordinatesLat`, `coordinatesLng` | separate top-level `number` scalars |
| Ingestion | `listing-session.ts:83` | `address.location` | nested `{lat, lng, alt}` object |

**Impact:** Ingestion geopoint is never written to Sanity. The publisher must extract `address.location.lat` → `coordinatesLat` and `address.location.lng` → `coordinatesLng`.

---

### MISMATCH 3 — `status` vs `lifecycleStatus` vs `isPublished` (CRITICAL)

| Side | File | Field | Values |
|---|---|---|---|
| Sanity | `property.ts:85–97` | `status` | `sale\|rent\|short-term` (deal type, REQUIRED) |
| Sanity | `property.ts:108–126` | `lifecycleStatus` | `draft\|active\|reserved\|sold\|rented\|archived` (optional, default `active`) |
| Sanity | `property.ts:99–106` | `isPublished` | boolean (default true) |
| Ingestion | `listing-session.ts:31` | `status` (listingStatus) | `draft\|in_review\|published\|archived` |
| Ingestion | `listing-session.ts:99` | `dealStatus` | `sale\|rent\|short-term` |

**Mapping needed:**
- Ingestion `dealStatus` → Sanity `status` ✓ (values match)
- Ingestion `status` (editorial) → **undefined mapping** — closest would be `lifecycleStatus` or `isPublished`
- Sanity `isPublished` — never set by ingestion tool
- Sanity `lifecycleStatus` — never set by ingestion tool

**Impact:** The ingestion `status` ("draft"|"in_review") has no clean Sanity equivalent. Publisher must decide the mapping. `isPublished` must be explicitly set on publish.

---

### MISMATCH 4 — `internalRef` vs `propertyCode` (CRITICAL)

| Side | File | Field |
|---|---|---|
| Sanity | `property.ts:275–280` | `propertyCode` (optional string) |
| Ingestion | `listing-session.ts:434` | `internalRef` (required for publish) |

**Impact:** The publish gate requires `internalRef` but Sanity has no `internalRef` field. Publisher must write to `propertyCode`. This mapping is undefined today.

---

### MISMATCH 5 — `amenities` vs `amenitiesRefs` (CRITICAL)

| Side | File | Field |
|---|---|---|
| Sanity | `property.ts:253–262` | `amenitiesRefs` |
| Ingestion | `listing-session.ts:406` | `amenities` |

**Impact:** Publisher would write to `amenities` but Sanity stores under `amenitiesRefs`. The mutation will silently succeed but write to a non-existent field.

---

### MISMATCH 6 — `coverImage` does not exist in Sanity (CRITICAL)

| Side | File | Field |
|---|---|---|
| Sanity | `property.ts` | NOT FOUND |
| Ingestion | `listing-session.ts:414` | `coverImage` (required for publish, with confirmation gate) |

**Impact:** Publish gate enforces `coverImage` exists in gallery. But Sanity has no dedicated `coverImage` field — the first gallery image is used as cover by the frontend. The publisher must treat `coverImage` as a front-end ordering signal only, not a Sanity field. The confirmation gate for `coverImage` is correct in concept (user must confirm a cover) but the implementation must use it only to ensure gallery[0] is the intended cover.

---

### MISMATCH 7 — Gallery item schema (CRITICAL)

| Field | Sanity (`property.ts:300–315`) | Ingestion (`listing-session.ts:252–274`) |
|---|---|---|
| `alt` | `string` | `string` (with coerce from `{en:...}`) ✓ |
| `label` | `string` (caption) | NOT PRESENT |
| `caption` | NOT PRESENT | `localizedString` (optional) |
| `roomType` | NOT PRESENT | enum string (optional) |
| `sortOrder` | NOT PRESENT | number (optional) |
| `aiGeneratedDescription` | NOT PRESENT | `localizedText` (optional) |

**Impact:** `caption` (ingestion) maps to `label` (Sanity) but the types differ (localized vs plain string). Fields `roomType`, `sortOrder`, `aiGeneratedDescription` will be silently ignored by Sanity. The publisher must map `caption.en` → `label`.

---

### MISMATCH 8 — `sanityPropertyTypeRef` optional vs Sanity `type` required (CRITICAL)

| Side | File | Required |
|---|---|---|
| Sanity | `property.ts:78–83` | `type` (ref) is **REQUIRED** |
| Ingestion publish payload | `listing-session.ts:458` | `sanityPropertyTypeRef` is **optional** |

**Impact:** A listing can pass the ingestion publish gate without a `sanityPropertyTypeRef`, then fail Sanity validation on write. Must be promoted to required in `publishListingPayloadSchema`.

---

### MISMATCH 9 — `sanityAgentRef` optional vs Sanity `agent` required (CRITICAL)

| Side | File | Required |
|---|---|---|
| Sanity | `property.ts:66–72` | `agent` (ref) is **REQUIRED** |
| Ingestion publish payload | `listing-session.ts:460` | `sanityAgentRef` is **optional** |

**Impact:** Same as above. A listing can pass the ingestion gate with no agent ref and fail Sanity validation. Must be promoted to required, or a default agent must be assigned.

---

### MISMATCH 10 — `slug` missing `_type: "slug"` (CRITICAL)

| Side | File | Shape |
|---|---|---|
| Sanity | `property.ts:34–48` | `{_type: "slug", current: string}` |
| Ingestion | `listing-session.ts:35–43` | `{current: string}` (no `_type`) |

**Impact:** Sanity mutations require `_type: "slug"` on the slug field. The ingestion slug object is missing this. The Sanity client will reject or silently mishandle the slug.

---

### MISMATCH 11 — `seo` schema shape (MODERATE)

| Side | File | Shape |
|---|---|---|
| Sanity `localizedSeo` | `schemaTypes/objects/localizedSeo.ts` | Full per-locale: metaTitle, metaDescription, keywords, ogTitle, ogDescription, twitterTitle, twitterDescription, ogImage, canonicalUrl, noIndex, noFollow |
| Ingestion | `listing-session.ts:322–338` | Flat: `{metaTitle (localized), metaDescription (localized), canonicalUrl, noIndex, ogImage}` |

**Impact:** Ingestion SEO is a subset. Missing: `keywords`, `ogTitle`, `ogDescription`, `twitterTitle`, `twitterDescription` per locale. Publisher can write the subset that exists but the Sanity seo object must be remapped into the `localizedSeo` nested structure.

---

### Fields That Correctly Align

| Field | Sanity | Ingestion | Notes |
|---|---|---|---|
| `price` | `number` (EUR) | `priceEurSchema` | ✓ exact match, legacy preprocess handled |
| `dealStatus` → `status` | `"sale"\|"rent"\|"short-term"` | same values | ✓ values match, field names differ (needs mapping) |
| `area` | `number` | `number` | ✓ |
| `bedrooms` | `number` | `number` | ✓ |
| `bathrooms` | `number` | `number` | ✓ |
| `yearBuilt` | `number` | `number` | ✓ |
| `locationTags` | array of refs | array of `{_type:"reference",_ref}` | ✓ field name matches |
| `propertyOffers` | embedded objects | embedded objects | ✓ correctly not a taxonomy |
| `title` | `localizedString` | `localizedStringSchema` | ✓ |
| `description` | `localizedText` | `localizedTextSchema` | ✓ |
| `shortDescription` | `localizedText` | `localizedTextSchema` | ✓ |
| Reference resolution (city/district/type) | dictionaries | `applyReferenceResolutionToFacts` | ✓ pipeline correct |

---

## 5. Architecture Strengths

### 5.1 Provider Pattern
**Files:** `src/lib/ai/index.ts`, `src/lib/publish/index.ts`, `src/lib/transcription/index.ts`, `src/lib/storage/index.ts`
All external integrations are behind interfaces with factory functions. Swapping providers requires only env var change. Stub providers enable development without real credentials. **Well-designed.**

### 5.2 Reference-Data Pipeline
**File:** `src/lib/sanity/reference-data.ts`
Reference data is fetched at intake time, not hardcoded. Matching is slug+English-title based with city-scoped district lookup. Invalid city/propertyType blocks intake. AI prompt includes full reference context. **Correct approach.**

### 5.3 Confirmation Gate
**File:** `src/lib/listing-session/confirmation.ts`
13 critical fields tracked with explicit user confirmation required before publish. Confirmation invalidated on draft change. **Good editorial safety mechanism.**

### 5.4 Zod Validation Boundary
**Files:** `src/lib/validation/listing-session.ts`, `src/lib/validation/extracted-facts.ts`
All JSON blobs (extractedFacts, generatedDraft, editedDraft) validated against Zod schemas on read. Legacy field normalization (dealType → dealStatus, areaTotal → area) handled in Zod preprocessors. **Correct defense-in-depth.**

### 5.5 AI Boundary
**File:** `src/lib/intake/prompt-templates.ts`
Prompt explicitly prohibits AI from inventing fields not in Sanity schema (furnished, elevator, distanceToSeaMeters, etc.) and routes these to `intakeHints`. **Correct containment.**

### 5.6 Fallback Draft Generation
**File:** `src/lib/listing-session/service.ts`
If OpenAI fails during draft generation, falls back to `StubDraftGenerator` which creates a minimal valid draft. Session never stuck in failed state due to AI outage.

### 5.7 Soft Deletes on Assets
**File:** `prisma/schema.prisma`
`SessionAsset.status` uses soft-delete (`deleted` status) rather than hard delete. Recoverable.

---

## 6. Architecture Problems

### 6.1 `SanityListingPublisher` is a stub (BLOCKER)
**File:** `src/lib/publish/providers/sanity-listing-publisher.ts`
The entire publish pipeline throws `notImplemented`. No Sanity mutations are written anywhere in the codebase. All 10 field mismatches above are unresolved in this layer.

### 6.2 `publishListingPayloadSchema` doesn't enforce Sanity-required refs
**File:** `src/lib/validation/listing-session.ts:454–461`
`sanityPropertyTypeRef` and `sanityAgentRef` are optional. Sanity requires `type` and `agent`. A listing can pass the gate and fail on Sanity write.

### 6.3 `internalRef` required in ingestion, maps to optional `propertyCode` in Sanity
**Files:** `listing-session.ts:434`, `property.ts:275`
The publish gate enforces `internalRef` but the Sanity field is `propertyCode` (optional). The mapping is undefined and no adapter exists.

### 6.4 `address` complex object vs Sanity `localizedString`
**Files:** `listing-session.ts:111–122`, `property.ts:183`
The ingestion `address` object is richer than what Sanity stores. The publisher needs explicit remapping. `city`, `district`, `streetLine`, `postalCode` from the address object are not persisted to Sanity as structured data.

### 6.5 Coordinates never reach Sanity
**Files:** `listing-session.ts:83–95`, `property.ts:193–208`
`address.location.lat/lng` in the ingestion draft never maps to `coordinatesLat`/`coordinatesLng` in Sanity. Coordinates would be silently lost.

### 6.6 `slug` missing `_type: "slug"`
**File:** `listing-session.ts:35–43`
Sanity requires `{_type: "slug", current}`. Ingestion produces `{current}`. Will fail or misbehave in Sanity client mutations.

### 6.7 Gallery `caption` vs `label` type mismatch
**Files:** `listing-session.ts:258`, `property.ts:304`
`caption` is `localizedString` in ingestion, `label` is plain `string` in Sanity. The publisher must extract `caption.en` → `label` and discard other locales. `roomType`, `sortOrder`, `aiGeneratedDescription` are silently ignored by Sanity.

### 6.8 `coverImage` is an ingestion-only concept
**File:** `listing-session.ts:414`
Sanity has no `coverImage` field. The confirmation requirement for `coverImage` is valid as a UX gate (ensuring the user confirms which image leads), but the publisher must not write it as a Sanity field.

### 6.9 Ingestion `status` has no Sanity mapping
**Files:** `listing-session.ts:31`, `confirmation.ts:5`
The `status` field (editorial workflow: draft/in_review/published/archived) is required by the publish gate and tracked in confirmation. But Sanity's equivalent is `lifecycleStatus` with different values. `isPublished` (boolean) and `lifecycleStatus` both need to be set by the publisher — neither is defined in the publish payload today.

### 6.10 `amenities` field name divergence
**Files:** `listing-session.ts:406`, `property.ts:253`
Ingestion writes to `amenities`; Sanity stores in `amenitiesRefs`. A mutation using ingestion field names writes to a non-existent Sanity field.

### 6.11 `seo` schema is a subset and structurally different
**Files:** `listing-session.ts:322–338`, Sanity `localizedSeo`
Ingestion seo is flat with top-level localized fields. Sanity `localizedSeo` is per-locale objects with more fields. Full compatibility requires a mapper.

### 6.12 No caching on reference data fetches
**File:** `src/lib/sanity/reference-data.ts:253`
`fetchSanityReferenceData()` fires 6 parallel GROQ queries on every intake call. No in-memory cache or TTL. At scale, this adds latency to every intake request.

---

## 7. What Must Be Fixed Before Real Publish

These are **publish blockers** in strict dependency order.

### P1 — Implement `SanityListingPublisher`
**File:** `src/lib/publish/providers/sanity-listing-publisher.ts`
Must translate `PublishListingPayload` → Sanity `createOrReplace` mutation document. Must handle ALL field name mismatches listed below.

### P2 — Define field name adapter (ingestion → Sanity)

The adapter must map:

| Ingestion field | Sanity field | Transform |
|---|---|---|
| `dealStatus` | `status` | direct value copy |
| `internalRef` | `propertyCode` | rename |
| `amenities[]` | `amenitiesRefs[]` | rename |
| `sanityPropertyTypeRef` | `type._ref` | wrap as `{_type:"reference", _ref}` |
| `sanityAgentRef` | `agent._ref` | wrap as `{_type:"reference", _ref}` |
| `sanityCityRef` | `city._ref` | wrap as `{_type:"reference", _ref}` |
| `sanityDistrictRef` | `district._ref` | wrap as `{_type:"reference", _ref}` |
| `locationTags[i]._ref` | `locationTags[i]` | already `{_type:"reference",_ref}` ✓ |
| `slug.current` | `slug` | wrap as `{_type:"slug", current}` |
| `address.displayAddress` | `address` | localizedString ✓ values |
| `address.location.lat` | `coordinatesLat` | extract from nested |
| `address.location.lng` | `coordinatesLng` | extract from nested |
| `gallery[i].caption.en` | `gallery[i].label` | extract English only |
| `coverImage` | (not a Sanity field) | use only as gallery[0] signal |
| `status` (editorial) | `lifecycleStatus` | needs explicit mapping table |
| (not in ingestion) | `isPublished` | must be set on publish |
| `seo` | `seo` (localizedSeo) | needs structural remap |

### P3 — Promote `sanityPropertyTypeRef` and `sanityAgentRef` to required in `publishListingPayloadSchema`
**File:** `src/lib/validation/listing-session.ts:458,460`
Or provide a default agent for MVP (configurable via env). Without this, Sanity will reject the document.

### P4 — Add `_type: "slug"` to slug in mutation document
**File:** `src/lib/validation/listing-session.ts:35–43`
Slug written to Sanity must be `{_type:"slug", current}`. The `slugSchema` can stay as-is (ingestion-internal); the adapter must add `_type`.

### P5 — Define `lifecycleStatus` mapping and set `isPublished`
**File:** `src/lib/listing-session/field-requirements.ts`
Decide: on publish, always write `lifecycleStatus: "active"` and `isPublished: true`? Or respect ingestion `status` field? Map must be explicit.

---

## 8. What Must Be Fixed Before AI Improvements

These block safe AI improvement but not basic publish:

### A1 — `listingDraftJsonSchema` must not include unsupported fields
**File:** `src/lib/ai/providers/openai-draft-generator.ts`
If the JSON schema passed to OpenAI includes `coverImage`, `roomType`, or `address` as complex objects, the AI may populate them. Verify the JSON schema matches what can actually be published. (Full file content not read — flag for review.)

### A2 — Reference data caching
**File:** `src/lib/sanity/reference-data.ts`
Before adding more AI calls per intake, add a short TTL cache (5–10 min) for reference data. 6 GROQ queries per intake call will not scale.

### A3 — `intakeHints` has no schema
**File:** `src/lib/validation/extracted-facts.ts:34`
`intakeHints: z.record(z.unknown())` is a catch-all. As AI extracts more non-schema facts, this should be typed to avoid silent data loss or confusion.

### A4 — Stub draft generator produces `confidence: 0.35`
**File:** `src/lib/ai/providers/stub-draft-generator.ts`
Stub is used as fallback. The low confidence warning is correct, but if the system relies on confidence thresholds for future AI gating, stub confidence must not accidentally pass gates.

---

## 9. Recommended Refactor Order

### Phase 1 — Pre-publish (do these first, in order)

1. **Write the field adapter / mutation builder** — new file `src/lib/publish/sanity-mutation-builder.ts`. Maps `PublishListingPayload` → Sanity document shape. Include all 14 field remappings from section 7 P2.
2. **Implement `SanityListingPublisher`** — call `client.createOrReplace()` using the mutation builder output.
3. **Promote `sanityPropertyTypeRef` and `sanityAgentRef` to required** in `publishListingPayloadSchema`. Add to `INTAKE_REQUIRED_FACT_KEYS` or provide MVP default.
4. **Define `lifecycleStatus` + `isPublished` behavior on publish** — hardcode for MVP: `lifecycleStatus: "draft"`, `isPublished: false` (let editor manually publish), or `lifecycleStatus: "active"`, `isPublished: true`. Write this as a constant in the mutation builder.
5. **Test the mutation** against the live Sanity dataset with a single known-good draft. Verify all required fields are accepted.

### Phase 2 — Pre-AI improvements

6. **Cache `fetchSanityReferenceData`** with in-memory TTL (5–10 min).
7. **Audit `listingDraftJsonSchema`** in OpenAI generator. Remove or mark unsupported fields.
8. **Type `intakeHints`** with known keys.

### Phase 3 — Post-MVP improvements (do not touch yet)

9. Add localized `address` support (if Sanity schema is extended to support structured address).
10. Add coordinates UI to ingestion tool (currently never collected).
11. Extend `seo` schema in ingestion to match full `localizedSeo` structure.
12. Gallery `roomType` and `sortOrder` — extend Sanity schema if needed, or remove from ingestion model.
13. `coverImage` — if Sanity adds a dedicated cover field, wire it. Until then, use gallery order.
14. Full i18n of gallery `caption` — extend Sanity gallery item schema.

### Do Not Touch Yet

- UI components (`src/components/`)
- Prisma schema (no changes needed for MVP)
- Storage providers (working)
- Transcription providers (working)
- Confirmation gate logic (correct)
- Reference resolution logic (correct)
- Prompt templates (correct direction)

---

## 10. Files Reviewed

### Ingestion Repo (`domlivo-ai-gen`)

| File | What was reviewed |
|---|---|
| `prisma/schema.prisma` | DB models: ListingSession, SessionAsset |
| `package.json` | Dependencies, scripts |
| `src/lib/validation/listing-session.ts` | Full domain model, publish payload schema |
| `src/lib/validation/extracted-facts.ts` | Extracted facts schema |
| `src/lib/validation/property-i18n.ts` | Localization schemas |
| `src/lib/listing-session/service.ts` | Full workflow orchestrator |
| `src/lib/listing-session/confirmation.ts` | Confirmation gate |
| `src/lib/listing-session/field-requirements.ts` | Intake/publish requirements |
| `src/lib/listing-session/publish-payload.ts` | Publish gate logic |
| `src/lib/listing-session/draft-mapper.ts` | ExtractedFacts → ListingDraft |
| `src/lib/sanity/reference-data.ts` | GROQ queries, reference resolution |
| `src/lib/sanity/property-detail-contract.ts` | Contract notes |
| `src/lib/sanity/property-icon-keys.ts` | Icon allowlist |
| `src/lib/publish/providers/sanity-listing-publisher.ts` | Publish implementation (stub) |
| `src/lib/publish/providers/stub-listing-publisher.ts` | Stub publisher |
| `src/lib/publish/index.ts` | Publisher factory |
| `src/lib/ai/providers/openai-draft-generator.ts` | AI draft generator |
| `src/lib/ai/providers/stub-draft-generator.ts` | Stub draft generator |
| `src/lib/extraction/extract-facts.ts` | Regex extraction |
| `src/lib/intake/openai-intake-analyzer.ts` | Semantic extraction |
| `src/lib/intake/prompt-templates.ts` | AI prompt builder |
| `src/lib/config/server.ts` | Env config schema |
| `src/lib/errors/app-error.ts` | Error types |
| `sanity-real-estate-query-contract.md` | Cross-repo query contract doc |

### Sanity Repo (`domlivo-admin`)

| File | What was reviewed |
|---|---|
| `schemaTypes/documents/property.ts` | Full property schema (all fields, validation, groups) |
| `schemaTypes/documents/city.ts` | City schema |
| `schemaTypes/documents/district.ts` | District schema |
| `schemaTypes/documents/agent.ts` | Agent schema |
| `schemaTypes/documents/amenity.ts` | Amenity schema |
| `schemaTypes/documents/propertyType.ts` | PropertyType schema |
| `schemaTypes/documents/locationTag.ts` | LocationTag schema |
| `schemaTypes/objects/propertyOffer.ts` | PropertyOffer embedded object |
| `schemaTypes/objects/localizedSeo.ts` | SEO schema structure |
| `schemaTypes/constants/iconOptions.ts` | Icon allowlist |
| `sanity.config.ts` | Studio config |
| `package.json` | Scripts, dependencies |

---

## 11. Open Questions / Unclear Areas

1. **`SanityListingPublisher` — `createOrReplace` vs `create` strategy?**
   If a session is re-published (e.g. after edit), should it update the existing Sanity document or create a new one? `sanityDocumentId` is stored on the session after first publish — needs a decision before implementation.

2. **`lifecycleStatus` mapping — what should newly published listings default to?**
   Options: always `draft` (editor reviews), always `active` (goes live immediately). This is a business decision. ASSUMPTION: MVP should default to `lifecycleStatus: "draft"` and `isPublished: false` for safety.

3. **`agent` requirement — MVP workaround?**
   Sanity requires `agent` on every property. The ingestion tool makes it optional. Is there a default agent account that all AI-generated listings should be assigned to until reviewed? If yes, add `SANITY_DEFAULT_AGENT_ID` env var as fallback in the mutation builder.

4. **`internalRef` generation — who generates it?**
   `publishListingPayloadSchema` requires `internalRef` but nothing in the ingestion tool generates it automatically. Does the agent manually enter it? Is it auto-generated from session ID? NOT FOUND in service or draft mapper. This is a UX gap.

5. **Re-publishing / idempotency**
   `publishListingSession` in `service.ts` does not check if `sanityDocumentId` already exists before calling `publish()`. If called twice, it would either create a duplicate or overwrite, depending on the Sanity mutation type. Needs explicit guard.

6. **Full `listingDraftJsonSchema` content**
   `src/lib/ai/providers/openai-draft-generator.ts` references `listingDraftJsonSchema` for structured output. The full JSON schema was not read. It must be audited to confirm it does not ask the AI to produce `coverImage`, `roomType`, or other ingestion-only fields as top-level structured outputs.

7. **Gallery temp-asset → Sanity asset upload**
   Gallery images are stored as temp assets (`storageKey`). The publish pipeline needs to upload each temp image to Sanity Assets API and replace `storageKey` references with real Sanity `asset._ref` values. This upload step is NOT present anywhere in the current codebase. This is a **hidden blocker** for `SanityListingPublisher` implementation.

8. **`address.city` in confirmation vs `sanityCityRef`**
   The confirmation gate tracks `address.city` (string). But the Sanity publisher needs `sanityCityRef` (Sanity document `_id`). If the user changes the city display name but the ref stays the same, confirmation would be invalidated unnecessarily. These are distinct concerns.
