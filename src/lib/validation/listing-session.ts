import { z } from "zod";

import { isAllowedPropertyOfferIconKey } from "@/lib/sanity/property-icon-keys";

import { localizedStringSchema, localizedTextSchema } from "@/lib/validation/property-i18n";



export const listingSessionStatusSchema = z.enum([

  "collecting",

  "processing",

  "ready",

  "editing",

  "publishing",

  "published",

  "failed",

]);



/** Editorial workflow for the intake session (not `property.lifecycleStatus`). */

export const listingStatusSchema = z.enum(["draft", "in_review", "published", "archived"]);



export const slugSchema = z

  .object({

    current: z.string().trim().min(1),

  })

  .strict();



/** Legacy money object — only EUR is canonical for Sanity property.price. */

export const moneySchema = z

  .object({

    amount: z.number().min(0),

    currency: z.enum(["EUR", "USD", "ALL", "GBP"]),

  })

  .strict();



/** Sanity `property.price`: EUR scalar ≥ 0. Accepts legacy `{ amount, currency: EUR }`. */

export const priceEurSchema = z.preprocess((val) => {

  if (typeof val === "number" && Number.isFinite(val)) return val;

  if (val && typeof val === "object" && "amount" in val) {

    const o = val as { amount?: unknown; currency?: string };

    if (typeof o.amount === "number" && (!o.currency || o.currency === "EUR")) return o.amount;

  }

  return val;

}, z.number().min(0));



export const geoPointSchema = z

  .object({

    lat: z.number().min(-90).max(90),

    lng: z.number().min(-180).max(180),

    alt: z.number().optional(),

  })

  .strict();



export const dealStatusSchema = z.enum(["sale", "rent", "short-term"]);

const localizedStringLooseSchema = z
  .object({
    en: z.string().optional(),
    uk: z.string().optional(),
    ru: z.string().optional(),
    sq: z.string().optional(),
    it: z.string().optional(),
  })
  .strict();

export const addressSchema = z
  .object({
    countryCode: z.string().trim().length(2).optional(),
    city: z.string().trim().min(1).optional(),
    district: z.string().trim().min(1).optional(),
    streetLine: z.string().trim().min(1).optional(),
    postalCode: z.string().trim().min(1).optional(),
    displayAddress: localizedStringLooseSchema,
    location: geoPointSchema.optional(),
    hideExactLocation: z.boolean(),
  })
  .strict();



/** Facts aligned with Sanity `property`: area, bedrooms, bathrooms, yearBuilt — no rooms/hasElevator/etc. */

export const propertyFactsDraftSchema = z

  .object({

    propertyType: z.string().trim().min(1).optional(),

    area: z.number().min(0).optional(),

    bedrooms: z.number().int().min(0).optional(),

    bathrooms: z.number().int().min(0).optional(),

    yearBuilt: z.number().int().min(1800).max(2100).optional(),

  })

  .strict();



export const propertyFactsPublishSchema = z

  .object({

    propertyType: z.string().trim().min(1),

    area: z.number().min(0),

    bedrooms: z.number().int().min(0).optional(),

    bathrooms: z.number().int().min(0).optional(),

    yearBuilt: z.number().int().min(1800).max(2100).optional(),

  })

  .strict();



/** Legacy facts preprocess: `areaTotal` → `area`, strips non-schema keys. */

function normalizeFactsInput(raw: unknown): unknown {

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;

  const o = raw as Record<string, unknown>;

  const area =

    typeof o.area === "number"

      ? o.area

      : typeof o.areaTotal === "number"

        ? o.areaTotal

        : undefined;

  return {

    ...(typeof o.propertyType === "string" ? { propertyType: o.propertyType } : {}),

    ...(area !== undefined ? { area } : {}),

    ...(typeof o.bedrooms === "number" ? { bedrooms: o.bedrooms } : {}),

    ...(typeof o.bathrooms === "number" ? { bathrooms: o.bathrooms } : {}),

    ...(typeof o.yearBuilt === "number" ? { yearBuilt: o.yearBuilt } : {}),

  };

}



export const propertyFactsSchema = z.preprocess(normalizeFactsInput, propertyFactsDraftSchema);



export const sanityImageSchema = z

  .object({

    _type: z.literal("image"),

    asset: z

      .object({

        _type: z.literal("reference"),

        _ref: z.string().min(1),

      })

      .strict(),

  })

  .strict();



function coerceGalleryAlt(v: unknown): string {

  if (typeof v === "string") return v;

  if (v && typeof v === "object" && v !== null && "en" in v) {

    const en = (v as { en?: string }).en;

    return typeof en === "string" ? en : "";

  }

  return "";

}



export const listingImageSchema = z

  .object({

    image: sanityImageSchema,

    caption: localizedStringSchema.optional(),

    alt: z.preprocess(coerceGalleryAlt, z.string()),

    roomType: z

      .enum(["exterior", "living-room", "kitchen", "bedroom", "bathroom", "balcony", "view", "building", "other"])

      .optional(),

    sortOrder: z.number().int().min(0).optional(),

    aiGeneratedDescription: localizedTextSchema.optional(),

  })

  .strict();



export const amenityRefSchema = z

  .object({

    _type: z.literal("reference"),

    _ref: z.string().min(1),

    _weak: z.boolean().optional(),

  })

  .strict();



export const locationTagRefSchema = amenityRefSchema;



export const embeddedPropertyOfferSchema = z

  .object({

    title: localizedStringSchema,

    iconKey: z.string().optional(),

  })

  .strict()

  .superRefine((row, ctx) => {

    if (row.iconKey && !isAllowedPropertyOfferIconKey(row.iconKey)) {

      ctx.addIssue({ code: "custom", message: "iconKey must be in PROPERTY_ICON_KEYS or omitted", path: ["iconKey"] });

    }

  });



export const seoSchema = z

  .object({

    metaTitle: localizedStringSchema.optional(),

    metaDescription: localizedTextSchema.optional(),

    canonicalUrl: z.string().url().optional(),

    noIndex: z.boolean().optional(),

    ogImage: sanityImageSchema.optional(),

  })

  .strict();



export const aiMetadataSchema = z

  .object({

    sourcePrompt: z.string().optional(),

    transcript: z.string().optional(),

    provider: z.string().optional(),

    model: z.string().optional(),

    confidence: z.number().min(0).max(1).optional(),

    warnings: z.array(z.string().min(1)).optional(),

    rawExtractedFacts: z.record(z.unknown()).optional(),

    generatedAt: z.string().datetime().optional(),

  })

  .strict();



const draftPriceSchema = z.union([priceEurSchema, z.undefined()]);



export const listingDraftSchema = z

  .object({

    internalRef: z.string().trim().min(1).optional(),

    status: listingStatusSchema.optional(),

    title: localizedStringSchema.optional(),

    slug: slugSchema.optional(),

    shortDescription: localizedTextSchema.optional(),

    description: localizedTextSchema.optional(),

    price: draftPriceSchema.optional(),

    /** Maps to Sanity `property.status` (sale | rent | short-term). */

    dealStatus: dealStatusSchema.optional(),

    facts: propertyFactsSchema.optional(),

    address: addressSchema.optional(),

    sanityCityRef: z.string().min(1).optional(),

    sanityDistrictRef: z.string().min(1).optional(),

    sanityPropertyTypeRef: z.string().min(1).optional(),

    sanityAgentRef: z.string().min(1).optional(),

    amenities: z.array(amenityRefSchema).optional(),

    locationTags: z.array(locationTagRefSchema).optional(),

    propertyOffers: z.array(embeddedPropertyOfferSchema).optional(),

    gallery: z.array(listingImageSchema).optional(),

    coverImage: sanityImageSchema.optional(),

    seo: seoSchema.optional(),

    ai: aiMetadataSchema.optional(),

    publishedAt: z.string().datetime().optional(),

    sourceSessionId: z.string().optional(),

  })

  .strict();



export const publishListingPayloadSchema = z

  .object({

    internalRef: z.string().trim().min(1),

    status: listingStatusSchema,

    title: localizedStringSchema,

    slug: slugSchema,

    shortDescription: localizedTextSchema.optional(),

    description: localizedTextSchema,

    price: priceEurSchema,

    dealStatus: dealStatusSchema,

    facts: z.preprocess(normalizeFactsInput, propertyFactsPublishSchema),

    address: addressSchema.optional(),

    sanityCityRef: z.string().min(1).optional(),

    sanityDistrictRef: z.string().min(1).optional(),

    /** Required for publish: Sanity `property.type` is a required reference. */
    sanityPropertyTypeRef: z.string().min(1),

    /** Required for publish: Sanity `property.agent` is a required reference. */
    sanityAgentRef: z.string().min(1),

    amenities: z.array(amenityRefSchema).optional(),

    locationTags: z.array(locationTagRefSchema).optional(),

    propertyOffers: z.array(embeddedPropertyOfferSchema).optional(),

    gallery: z.array(listingImageSchema).min(1),

    coverImage: sanityImageSchema,

    seo: seoSchema.optional(),

    ai: aiMetadataSchema.optional(),

    publishedAt: z.string().datetime().optional(),

    sourceSessionId: z.string().optional(),

  })

  .strict();



export const createSessionSchema = z.object({

  agentId: z.string().min(1).default("agent-mvp"),

});



export const updateSessionSchema = z

  .object({

    sourceText: z.string().trim().min(1).optional(),

    editedDraft: listingDraftSchema.optional(),

    confirmationSet: z.array(z.string().min(1)).optional(),

    confirmationUnset: z.array(z.string().min(1)).optional(),

  })

  .refine(

    (value) =>

      value.sourceText !== undefined ||

      value.editedDraft !== undefined ||

      value.confirmationSet !== undefined ||

      value.confirmationUnset !== undefined,

    {

      message: "At least one field is required",

    },

  );



export type ListingDraft = z.infer<typeof listingDraftSchema>;

export type PublishListingPayload = z.infer<typeof publishListingPayloadSchema>;

export type EmbeddedPropertyOffer = z.infer<typeof embeddedPropertyOfferSchema>;

