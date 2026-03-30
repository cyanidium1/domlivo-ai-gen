/**

 * Single source of truth for intake vs publish — aligned with

 * `sanity-real-estate-query-contract.md` and `property-field-support.ts`.

 */



/** Blocks draft generation until satisfied (with assets + reference validation). */

export const INTAKE_REQUIRED_FACT_KEYS = [

  "price",

  "dealStatus",

  "city",

  "propertyType",

  "area",

  "photo",

] as const;



/** Nice-to-have; never blocks intake readiness. */

export const INTAKE_OPTIONAL_FACT_KEYS = [

  "bedrooms",

  "bathrooms",

  "yearBuilt",

  "district",

  "displayAddress",

  "streetLine",

  "postalCode",

] as const;



export const PUBLISH_REQUIRED_PATHS = [

  "internalRef",

  "status",

  "title",

  "description",

  "price",

  "dealStatus",

  "facts",

  "gallery",

  "coverImage",

] as const;



export const PUBLISH_OPTIONAL_PATHS = [

  "shortDescription",

  "address",

  "sanityCityRef",

  "sanityDistrictRef",

  "sanityPropertyTypeRef",

  "sanityAgentRef",

  "amenities",

  "locationTags",

  "propertyOffers",

  "seo",

  "publishedAt",

] as const;



export type IntakeRequiredFactKey = (typeof INTAKE_REQUIRED_FACT_KEYS)[number];

export type IntakeOptionalFactKey = (typeof INTAKE_OPTIONAL_FACT_KEYS)[number];


