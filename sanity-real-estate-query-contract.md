# Sanity Real Estate — Query Contract & Data Access Map

This document is the **authoritative developer reference** for GROQ/query contracts in this repository: what schemas exist for real estate, what can be filtered, what dictionaries the AI ingestion tool must load, which queries already ship in `lib/sanity`, and which GROQ patterns are **recommended** to fill gaps.

**Localization rule (project-wide):** localized fields are stored as objects with locale keys `en`, `uk`, `ru`, `sq`, `it` (see `lib/languages.ts`). **Do not resolve locale inside GROQ** — return raw objects; the frontend resolves with `getLocalizedValue(field, locale)` (see `lib/sanity/queries.ts` header comments).

**Currency:** `property.price` is **EUR only** (schema description). Legacy `currency` on property was removed (see `scripts/migrateRemovePropertyCurrency.ts`).

---

## 1. Executive Summary

- **Schemas:** Real estate content is centered on the `property` document plus reference taxonomies: `city`, `district`, `propertyType`, `amenity`, `locationTag`, `agent`. SEO for listings uses `localizedSeo` on `property` and `catalogSeoPage` for catalog routes. **Property “offers/advantages”** are **not** a separate document type — they are **embedded** `propertyOffer` objects on `property.propertyOffers[]` (localized title + optional `iconKey` from a fixed list + optional `customIcon`).
- **Existing query layer:** `lib/sanity/queries.ts` + `lib/sanity/fragments.ts` provide list/detail for properties, dictionaries for types/tags/amenities, cities/districts pages, site settings, featured properties, etc.
- **Gaps:** No first-class **agents list** query, no **districts-by-city** dictionary query, no **`catalogSeoPage`** query in `lib/sanity`. **`PROPERTY_FULL_FRAGMENT` omits `propertyOffers`** (and several optional fields), so the detail contract is incomplete vs schema. **`PROPERTY_BY_SLUG_QUERY` does not enforce `isPublished` / lifecycle** — a draft or hidden listing could be fetched by slug if IDs overlap (risk).
- **Filters:** Implementable in GROQ for fields that **exist** on `property` (city/district/type/status/price/area/bedrooms/bathrooms/yearBuilt/locationTags/amenitiesRefs/featured/investment/isPublished/lifecycleStatus). Fields like **furnished, elevator, distance to sea, parking spots, energy class, rooms** are **not modeled** as scalar filters on `property` in this schema (amenities may partially cover some via taxonomy).
- **AI ingestion:** Must preload **reference dictionaries** (`city`, `district` scoped by city, `propertyType`, `amenity`, `locationTag`, `agent`) and **icon allowlist** (`schemaTypes/constants/iconOptions.ts`). **Property offers** cannot be validated against a global CMS dictionary — only against **schema rules** (localized title required per item; `iconKey` ∈ `PROPERTY_ICON_KEYS` or empty + `customIcon`).

---

## 2. Real Estate Schemas Found

### 2.1 `property` (`schemaTypes/documents/property.ts`) — document

| Aspect | Details |
|--------|---------|
| **Stable name** | `_type == "property"` |
| **Required (validation)** | `title` (localizedString), `slug`, `agent` → `agent`, `type` → `propertyType`, `status`, `price` (≥ 0), `city` → `city`, `gallery` (min 1, max 30 images) |
| **Optional** | `shortDescription`, `description`, `district`, `address`, `coordinatesLat`/`coordinatesLng`, `locationTags[]`, `area`, `bedrooms`, `bathrooms`, `yearBuilt`, `amenitiesRefs[]`, `propertyOffers[]`, `propertyCode`, `articlesSection`, `seo`, `createdAt`, analytics counters, `ownerUserId` (hidden) |
| **Localized** | `title`, `shortDescription`, `description`, `address`, `seo` (`localizedSeo`), `propertyOffers[].title` |
| **References** | `agent`, `type`, `city`, `district?`, `locationTags[]`, `amenitiesRefs[]` |
| **Enum-like** | `status`: `sale` \| `rent` \| `short-term` — `lifecycleStatus`: `draft` \| `active` \| `reserved` \| `sold` \| `rented` \| `archived` |
| **Booleans** | `isPublished` (default true), `featured`, `investment` |
| **Preview** | Uses `title.en|ru|uk|sq` (note: **not `it`** in preview select), `status`, `price`, `city.title`, `gallery.0` |
| **Query-relevant validation** | `amenitiesRefs` unique; `district` picker filtered by selected `city` in Studio (ingestion must still enforce `district.city` matches `city`) |

### 2.2 `propertyOffer` (`schemaTypes/objects/propertyOffer.ts`) — **object**, not a document

| Aspect | Details |
|--------|---------|
| **Path** | `property.propertyOffers[]` |
| **Required** | `title` (localizedString) per item |
| **Optional** | `iconKey` (must be in `PROPERTY_ICON_KEYS` if set), `customIcon` |
| **Localized** | `title` only |
| **No global dictionary document** | Offers are free-form per property, constrained by icon keys + migration catalogs in scripts only |

### 2.3 `city` — document

Required: `title` (localized), `slug`. Optional: `popular`, `order`, `isPublished`, hero/content/media/faq/seo fields. **Localized** throughout marketing fields; `slug` is **single** `slug` field (not per-locale).

### 2.4 `district` — document

Required: `title`, `slug`, `city` → `city`. Optional: ordering, publishing, hero/content/media/faq/seo. **District ↔ city** is the key parent relation for dependent filters.

### 2.5 `propertyType` — document

Required: `title` (localized), `slug`. Optional: `image`, `shortDescription`, `order`, `active`.

### 2.6 `amenity` — document

Required: `title` (localized), `slug`. Optional: `description`, `iconKey`, `customIcon`, `order`, `active`. **Slug** is described as stable / non-localized URL key.

### 2.7 `locationTag` — document

Required: `title` (localized), `slug`. Optional: `description`, `active`.

### 2.8 `agent` — document

Required: `name`, `email`. Optional: `phone`, `photo`, `userId` (link to Sanity user). **Not localized.**

### 2.9 `localizedSeo` (`schemaTypes/objects/localizedSeo.ts`) — object

Used on `property.seo` and elsewhere. Fields: `metaTitle`, `metaDescription`, `keywords`, `ogTitle`, `ogDescription`, `twitterTitle`, `twitterDescription` (all localized except where noted), `ogImage` (single image + alt), `canonicalUrl`, `noIndex`, `noFollow`.

### 2.10 `catalogSeoPage` (`schemaTypes/documents/catalogSeoPage.ts`) — document

Scopes: `propertiesRoot` \| `city` \| `district` with refs to `city` / `district` as required by scope. Fields: `active`, `title`, `intro`, `bottomText`, `seo`. **No query in `lib/sanity/queries.ts` today.**

### 2.11 Gallery / images on `property`

`gallery[]` items are `image` with `hotspot`, plus **string** fields `alt`, `label` — **not localized** in schema.

### 2.12 Icon allowlist (amenities + property offers)

`schemaTypes/constants/iconOptions.ts` exports `PROPERTY_ICON_KEYS` and `PROPERTY_ICON_OPTIONS` — used by `amenity.iconKey` and `propertyOffer.iconKey`.

---

## 3. Filterable Fields Map

All paths below are on **`property`** unless stated otherwise.

| Schema path | Filter type | Allowed / notes | Frontend filter? | AI validation? | Depends on |
|-------------|-------------|-------------------|------------------|----------------|------------|
| `city` | Reference | `_ref` must exist | Yes | Yes — must resolve to valid `city._id` | — |
| `district` | Reference | Must belong to same city as `city` (Studio filter; **enforce in app**) | Yes | Yes | `city` |
| `type` | Reference | `propertyType._id` | Yes | Yes | — |
| `status` | Enum | `sale` \| `rent` \| `short-term` | Yes | Yes | — |
| `price` | Range scalar | number ≥ 0, EUR | Yes | Yes | — |
| `area` | Range scalar | ≥ 0 if set | Yes | Optional | — |
| `bedrooms` | Range / exact | ≥ 0 | Yes | Optional | — |
| `bathrooms` | Range / exact | ≥ 0 | Yes | Optional | — |
| `yearBuilt` | Range | 1800–2100 if set | Optional | Optional | — |
| `locationTags` | Multi reference | `locationTag._id` | Yes | Optional (resolve refs) | — |
| `amenitiesRefs` | Multi reference | `amenity._id` | Yes | Optional | — |
| `featured` | Boolean | | Yes | Optional | — |
| `investment` | Boolean | | Yes | Optional | — |
| `isPublished` | Boolean | | **Should** be true for public catalog | Yes for publish | — |
| `lifecycleStatus` | Enum | see §2.1 | Yes (`active` + treat undefined as active matches list query) | Yes | — |
| `agent` | Reference | | Admin / detail | Yes | — |
| **currency** | — | **Not in schema** (removed) | — | — | — |
| **furnished** | — | **Not a dedicated property field**; partial proxy via `amenity` slugs / icons if editors encode it | Via amenities only | Fuzzy | — |
| **hasElevator** | — | **Not a scalar field** | Via `amenity` / tags | Fuzzy | — |
| **distanceToSeaMeters** | — | **Not in schema** | — | — | — |
| **parkingSpots** | — | **Not in schema** | — | — | — |
| **energyClass** | — | **Not in schema** | — | — | — |
| **rooms** (combined) | — | **Not in schema** | — | — | — |

---

## 4. Reference Dictionaries Map

| Dictionary | Source `_type` | Identifier for APIs | Display label | Locale behavior | Parent / grouping | Canonical for AI? |
|------------|----------------|---------------------|---------------|-----------------|-------------------|---------------------|
| Cities | `city` | `_id`, `slug.current` | `title` (localized object) | Resolve in app | — | Yes — use `_id` for writes |
| Districts | `district` | `_id`, `slug.current` | `title` (localized) | Resolve in app | `city` ref | Yes — must pair with city |
| Property types | `propertyType` | `_id`, `slug.current` | `title` (localized) | Resolve | — | Yes |
| Amenities | `amenity` | `_id`, `slug.current` | `title` (localized) | Resolve | — | Yes — prefer `_id` over slug for stability |
| Location tags | `locationTag` | `_id`, `slug.current` | `title` (localized) | Resolve | — | Yes |
| Agents | `agent` | `_id` | `name` (string) | N/A | — | Yes |
| Property offers / advantages | **Embedded `propertyOffer` only** | N/A | N/A | Per-locale `title` | — | **No CMS-wide list** — AI should use **amenity** taxonomy + **icon allowlist**, or accept free-text offers with schema validation |
| Catalog SEO | `catalogSeoPage` | Composite: `pageScope` + refs | `title`, `seo` | Localized | City/district refs | For copy/SEO only, not intake |

---

## 5. Existing GROQ Queries Found

**File:** `lib/sanity/queries.ts` (imports fragments from `lib/sanity/fragments.ts`).

| Query constant | Purpose |
|----------------|---------|
| `PROPERTIES_LIST_QUERY` | All published + active lifecycle properties; uses `PROPERTY_CARD_FRAGMENT` |
| `PROPERTY_BY_SLUG_QUERY` | Single property by `slug.current`; uses `PROPERTY_FULL_FRAGMENT` |
| `FEATURED_PROPERTIES_QUERY` | Featured subset |
| `CITIES_LIST_QUERY` | Cities with `isPublished == true` |
| `CITY_PAGE_QUERY` | City landing content by city slug |
| `DISTRICT_PAGE_QUERY` | District page + `city` dereference |
| `PROPERTY_TYPES_QUERY` | Active property types |
| `LOCATION_TAGS_QUERY` | Active location tags |
| `AMENITIES_QUERY` | Active amenities |
| `SITE_SETTINGS_QUERY` | Site config, price/area ranges, currencies |
| `POPULAR_CITIES_QUERY` | Popular cities |

**Not found in `lib/sanity/queries.ts` for real estate:**

- Agents listing
- Districts filtered by city
- `catalogSeoPage` for catalog SEO
- Parameterized **catalog** query (filters / pagination / sort) — only unfiltered lists exist

**Fragments:** `PROPERTY_CARD_FRAGMENT`, `PROPERTY_FULL_FRAGMENT`, `AMENITY_FRAGMENT`, `PROPERTY_TYPE_FRAGMENT`, `LOCATION_TAG_FRAGMENT`, `CITY_CARD_FRAGMENT`, `DISTRICT_CARD_FRAGMENT`, etc. (`lib/sanity/fragments.ts`).

**Known fragment gaps vs `property` schema:**

- `PROPERTY_FULL_FRAGMENT` **includes** `locationTags`, `amenitiesRefs`, `articlesSection`, `seo`, full `gallery`.
- It **does not include** `propertyOffers`, `address`, `isPublished`, `createdAt`, `viewCount`, `saveCount`, `contactCount`, `ownerUserId`.
- `GALLERY_FRAGMENT` strips `label`; detail query uses raw `gallery` so **label is present** in `PROPERTY_BY_SLUG_QUERY`.
- `LOCATION_TAG_FRAGMENT` omits `slug.current` (schema has `slug`) — may matter for URL filters.

---

## 6. Recommended GROQ Queries

Below are **recommended** additions (not yet exported from `lib/sanity/index.ts` unless you add them). All use **actual field names** from schemas.

### 6.1 Extend property detail: include `propertyOffers` + intake fields

**Problem:** `PROPERTY_FULL_FRAGMENT` omits `propertyOffers` (and optionally `address`, `isPublished`).

```groq
// RECOMMENDED: PROPERTY_FULL_FRAGMENT_EXTENDED (conceptual — compose in fragments.ts)
*[_type == "property" && slug.current == $slug][0]{
  _id,
  title,
  slug,
  shortDescription,
  description,
  address,
  price,
  status,
  lifecycleStatus,
  isPublished,
  featured,
  investment,
  "city": city->{ _id, title, slug },
  "district": district->{ _id, title, slug, "cityRef": city._ref },
  "type": type->{ _id, title, "slug": slug.current, shortDescription, image },
  "locationTags": locationTags[]->{ _id, title, "slug": slug.current, description },
  gallery,
  "amenitiesRefs": amenitiesRefs[]->{
    _id, title, "slug": slug.current, description, iconKey,
    customIcon{ asset, crop, hotspot, alt }, order, active
  },
  propertyOffers[]{
    _key,
    _type,
    title,
    iconKey,
    customIcon{ asset, crop, hotspot, alt }
  },
  area, bedrooms, bathrooms, yearBuilt,
  coordinatesLat, coordinatesLng,
  propertyCode,
  "agent": agent->{ _id, name, email, phone, photo, userId },
  articlesSection{
    title, subtitle,
    cta{ href, label },
    cardCtaLabel, mode,
    "posts": posts[]->{
      _id, title, slug, excerpt, coverImage,
      publishedAt, featured,
      "author": author->{ _id, name, "slug": slug.current, photo },
      "categories": categories[]->{ _id, title, "slug": slug.current }
    }
  },
  seo,
  createdAt
}
```

### 6.2 Catalog listing with filters (recommended pattern)

Params example: `$cityId`, `$districtId`, `$typeId`, `$status`, `$minPrice`, `$maxPrice`, `$minArea`, `$maxArea`, `$bedrooms`, `$bathrooms`, `$amenityId`, `$tagId`, `$featured`, `$investment`.

```groq
*[
  _type == "property" &&
  isPublished == true &&
  (lifecycleStatus == "active" || !defined(lifecycleStatus)) &&
  (!defined($cityId) || city._ref == $cityId) &&
  (!defined($districtId) || district._ref == $districtId) &&
  (!defined($typeId) || type._ref == $typeId) &&
  (!defined($status) || status == $status) &&
  (!defined($minPrice) || price >= $minPrice) &&
  (!defined($maxPrice) || price <= $maxPrice) &&
  (!defined($minArea) || area >= $minArea) &&
  (!defined($maxArea) || area <= $maxArea) &&
  (!defined($bedrooms) || bedrooms == $bedrooms) &&
  (!defined($bathrooms) || bathrooms == $bathrooms) &&
  (!defined($amenityId) || $amenityId in amenitiesRefs[]._ref) &&
  (!defined($tagId) || $tagId in locationTags[]._ref) &&
  (!defined($featured) || featured == $featured) &&
  (!defined($investment) || investment == $investment)
] | order(_createdAt desc) {
  /* PROPERTY_CARD_FRAGMENT body — for dynamic sort by price vs date, use separate parameterized queries or sort client-side */
  _id,
  title,
  slug,
  price,
  featured,
  investment,
  status,
  lifecycleStatus,
  "city": city->{ _id, title, slug },
  "district": district->{ _id, title, slug },
  "type": type->{ _id, title, "slug": slug.current },
  "gallery": gallery[0],
  bedrooms,
  bathrooms,
  area
}
```

**Note:** Sorting in GROQ is often simpler as **fixed** orderings (multiple exported queries) or **client-side** sort after fetch for small pages. Use cursor/`_id` pagination for scale.

### 6.3 Districts by city (dictionary)

```groq
*[_type == "district" && city._ref == $cityId && (isPublished != false)]
| order(order asc, title.en asc) {
  _id,
  title,
  slug,
  "cityRef": city._ref,
  order,
  isPublished
}
```

(Adjust `isPublished` filter to match product rules.)

### 6.4 Agents (dictionary)

```groq
*[_type == "agent"] | order(name asc) {
  _id,
  name,
  email,
  phone,
  photo,
  userId
}
```

### 6.5 Catalog SEO page (for listing routes)

```groq
*[_type == "catalogSeoPage" && pageScope == $pageScope && active != false &&
  ($pageScope == "propertiesRoot" || city._ref == $cityId) &&
  ($pageScope != "district" || district._ref == $districtId)
][0]{
  _id,
  pageScope,
  active,
  title,
  intro,
  bottomText,
  seo,
  "city": city->{ _id, title, slug },
  "district": district->{ _id, title, slug, "cityRef": city._ref }
}
```

(You may split into three explicit queries per scope to avoid complex params.)

### 6.6 Slug collision check (ingestion)

```groq
count(*[_type == "property" && slug.current == $slug && _id != $excludeId])
```

### 6.7 Location tags with slug (for filter UI)

```groq
*[_type == "locationTag" && active == true]{
  _id,
  title,
  "slug": slug.current,
  description,
  active
}
```

---

## 7. Query Contract for Frontend Catalog

**Must return for each card** (aligns with `PROPERTY_CARD_FRAGMENT`):

- `_id`, `title` (raw localized object), `slug`, `price`, `featured`, `investment`, `status`, `lifecycleStatus`
- `city` → `{ _id, title, slug }`
- `district` → `{ _id, title, slug }` (optional if many listings omit district)
- `type` → `{ _id, title, slug }`
- `gallery[0]` first image (card thumbnail)
- `bedrooms`, `bathrooms`, `area`

**List query filter contract (public site):** match `PROPERTIES_LIST_QUERY` semantics:

- `isPublished == true`
- `lifecycleStatus == "active" || !defined(lifecycleStatus)`

**Dictionaries to load once:** `PROPERTY_TYPES_QUERY`, `AMENITIES_QUERY`, `LOCATION_TAGS_QUERY` (prefer extended slug projection in §6.7), `CITIES_LIST_QUERY`, districts-by-city when user picks city (`§6.3`), `SITE_SETTINGS_QUERY` for global ranges/currency display.

**SEO:** `catalogSeoPage` (`§6.5`) per route scope **if** content editors maintain it.

---

## 8. Query Contract for Property Detail Page

**Minimum from schema + current fragment:**

- All fields in `PROPERTY_FULL_FRAGMENT` **plus** **`propertyOffers`** if the UI shows “What this property offers”.
- Include **`address`** if map/address block is shown.
- Include **`isPublished`** if the site gates unpublished ( **`PROPERTY_BY_SLUG_QUERY` currently does not filter** — enforce in app or add filter to query).
- `gallery` full array (hotspot, `alt`, `label`).
- `seo` as `localizedSeo` object.
- `articlesSection` with resolved posts (existing `PROPERTY_ARTICLES_SECTION_FRAGMENT` pattern).

**References to dereference:** `city`, `district`, `type`, `locationTags`, `amenitiesRefs`, `agent`, `articlesSection.posts` → `blogPost` cards.

---

## 9. Query Contract for AI Ingestion Tool

### 9.1 Must fetch before generate / validate

| Data | Query | Match key |
|------|-------|-----------|
| Cities | `CITIES_LIST_QUERY` or stricter `*[_type=="city" && isPublished==true]` | `_id`, `slug.current` |
| Districts per city | §6.3 | `_id`, `slug.current`, parent `city._ref` |
| Property types | `PROPERTY_TYPES_QUERY` | `_id`, `slug.current` |
| Amenities | `AMENITIES_QUERY` | `_id`, `slug.current` |
| Location tags | `LOCATION_TAGS_QUERY` or §6.7 | `_id`, `slug.current` |
| Agents | §6.4 | `_id`, `name`, `email` |
| Icon keys | **Not in GROQ** — read from codebase `PROPERTY_ICON_KEYS` | exact string enum |

### 9.2 Required vs optional for **draft** create (schema validation)

**Required on create:** `title`, `slug.current`, `agent`, `type`, `status`, `price`, `city`, `gallery` (≥1 image asset).

**Optional at draft time:** `district`, `shortDescription`, `description`, `propertyOffers`, most detail fields, `seo`.

**Publish / public site:** should enforce `isPublished`, `lifecycleStatus` appropriate for listing, and **district ∈ city** (app validation).

### 9.3 Exact vs fuzzy matching

| Input | Match |
|-------|--------|
| City/district/type/amenity/tag **refs** | **Exact `_ref`** on write |
| Slugs | Exact match against dictionary queries if slug-based intake |
| `status` | Exact: `sale` \| `rent` \| `short-term` |
| `propertyOffer.iconKey` | Exact against `PROPERTY_ICON_KEYS` or omit + use `customIcon` |
| Natural language amenity labels | **Fuzzy** — map to `amenity._id` via search/embedding in the tool, **not** in Sanity |

### 9.4 Property offers

- **No** global “allowed offers” list in Sanity.
- Validation: each array item has required localized `title`; `iconKey` optional but must be valid if present.

---

## 10. Schema / Query Risks

1. **`PROPERTY_FULL_FRAGMENT` missing `propertyOffers`** — detail page / AI may omit “advantages” unless query extended.
2. **`PROPERTY_BY_SLUG_QUERY` lacks `isPublished` / lifecycle guard** — may expose unpublished/archived listings.
3. **`status` vs UI elsewhere:** property uses `short-term`; `heroSearchTab` uses `shortTerm` — **not the same string**; risk of filter bugs if frontend conflates them.
4. **No scalar filters** for furnished/elevator/parking count/energy/distance — only via **amenity** / **locationTag** encodings.
5. **`district` depends on `city`** — ingestion must validate reference integrity (GROQ: fetch district and compare `city._ref`).
6. **`propertyOffers` not a taxonomy** — duplicate strings across properties; harder to normalize AI output.
7. **`LOCATION_TAG_FRAGMENT` omits `slug`** — hurts slug-based filters unless query extended.
8. **`GALLERY_FRAGMENT` in `fragments.ts` drops `label`** — do not use `GALLERY_FRAGMENT` for detail if `label` is needed.
9. **Preview on `property` omits `title.it`** — editorial UX only.
10. **Catalog SEO** not wired in `lib/sanity` — frontend may miss H1/SEO for `/properties` routes.

---

## 11. Files Reviewed

- `schemaTypes/documents/property.ts`
- `schemaTypes/objects/propertyOffer.ts`
- `schemaTypes/documents/city.ts` (referenced)
- `schemaTypes/documents/district.ts` (referenced)
- `schemaTypes/documents/propertyType.ts` (referenced)
- `schemaTypes/documents/amenity.ts` (referenced)
- `schemaTypes/documents/locationTag.ts` (referenced)
- `schemaTypes/documents/agent.ts`
- `schemaTypes/documents/catalogSeoPage.ts`
- `schemaTypes/objects/localizedSeo.ts`
- `schemaTypes/constants/iconOptions.ts`
- `lib/languages.ts`
- `lib/sanity/queries.ts`
- `lib/sanity/fragments.ts`
- `lib/sanity/index.ts`
- `scripts/migrateRemovePropertyCurrency.ts` (currency removal context)

---

## 12. Concrete Next Steps

1. Add **`PROPERTY_FULL_FRAGMENT`** extension or new fragment including `propertyOffers`, `address`, `isPublished` as needed by the product.
2. Add **`AGENTS_QUERY`**, **`DISTRICTS_BY_CITY_QUERY`**, **`CATALOG_SEO_PAGE_QUERY`** to `lib/sanity/queries.ts` and export from `lib/sanity/index.ts`.
3. Add **`CATALOG_PROPERTIES_FILTERED_QUERY`** (or server route) with agreed params and **documented sort/pagination** limits.
4. Tighten **`PROPERTY_BY_SLUG_QUERY`** with `&& isPublished == true && (lifecycleStatus == "active" || !defined(lifecycleStatus))`** for public site, or use a separate `PROPERTY_PUBLIC_BY_SLUG_QUERY`.
5. Extend **`LOCATION_TAG_FRAGMENT`** (or parallel export) to include **`"slug": slug.current`** for filter UIs.
6. Align **deal type strings** (`short-term` vs `shortTerm`) across CMS schema and frontend search tabs.
7. For AI: ship a small **`icon-keys.json`** or codegen from `iconOptions.ts` for the ingestion service if it cannot import TS from this repo.

---

*End of document.*
