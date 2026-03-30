import { z } from "zod";



import { dealStatusSchema } from "@/lib/validation/listing-session";



/**

 * Intake extraction — canonical fields match Sanity-backed filters/refs.

 * Non-schema hints (elevator, rooms count, sea distance, etc.) go to `intakeHints` only.

 */

export const extractedFactsSchema = z

  .object({

    /** EUR only — matches Sanity `property.price`. */

    price: z.number().positive().optional(),

    area: z.number().positive().optional(),

    /** @deprecated legacy sessions; prefer `area` */

    areaTotal: z.number().positive().optional(),

    bedrooms: z.number().int().nonnegative().optional(),

    bathrooms: z.number().int().nonnegative().optional(),

    yearBuilt: z.number().int().min(1800).max(2100).optional(),

    country: z.string().min(1).optional(),

    city: z.string().min(1).optional(),

    displayAddress: z.string().min(1).optional(),

    district: z.string().min(1).optional(),

    streetLine: z.string().min(1).optional(),

    postalCode: z.string().min(1).optional(),

    /** Free-text or slug; resolved against Sanity `propertyType` documents. */

    propertyType: z.string().min(1).optional(),

    /** Maps to Sanity `property.status`. */

    dealStatus: dealStatusSchema.optional(),

    /** @deprecated use dealStatus */

    dealType: z.enum(["sale", "rent"]).optional(),

    sanityCityRef: z.string().min(1).optional(),

    sanityDistrictRef: z.string().min(1).optional(),

    sanityPropertyTypeRef: z.string().min(1).optional(),

    /** Non-canonical extractions — never persisted as property scalars. */

    intakeHints: z.record(z.unknown()).optional(),

  })

  .strict();



export type ExtractedFacts = z.infer<typeof extractedFactsSchema>;



/** Normalize legacy `dealType` / `areaTotal` after parse. */

export function normalizeExtractedFacts(facts: ExtractedFacts): ExtractedFacts {

  const dealStatus =

    facts.dealStatus ??

    (facts.dealType === "rent" ? "rent" : facts.dealType === "sale" ? "sale" : undefined);

  const { dealType: _dt, ...rest } = facts;

  const area = rest.area ?? rest.areaTotal;

  const next: ExtractedFacts = {

    ...rest,

    ...(dealStatus !== undefined ? { dealStatus } : {}),

    ...(area !== undefined ? { area } : {}),

    country: "Albania",

  };

  delete (next as { areaTotal?: unknown }).areaTotal;

  delete (next as { dealType?: unknown }).dealType;

  return extractedFactsSchema.parse(next);

}


