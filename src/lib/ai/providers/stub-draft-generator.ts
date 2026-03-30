import type { DraftGenerator, DraftGeneratorInput } from "@/lib/ai/types";
import { listingDraftSchema } from "@/lib/validation/listing-session";
import { createEmptyLocalizedString, createEmptyLocalizedText } from "@/lib/validation/property-i18n";

function factArea(f: NonNullable<DraftGeneratorInput["extractedFacts"]>) {
  return f.area ?? f.areaTotal;
}

/** Fills all 5 locale slots with the same value (for stub/test mode). */
function fillAllLocales(value: string): Record<string, string> {
  return { en: value, uk: value, ru: value, sq: value, it: value };
}

export class StubDraftGenerator implements DraftGenerator {
  async generate(input: DraftGeneratorInput) {
    const baseText = input.sourceText.trim() || input.transcript?.trim() || "Beautiful property";
    const price = input.extractedFacts.price;
    const area = factArea(input.extractedFacts);
    const city = input.extractedFacts.city ?? "";
    const propertyType = input.extractedFacts.propertyType ?? "apartment";
    const dealStatus = input.extractedFacts.dealStatus ?? "sale";

    const titleText = `${propertyType}${city ? ` in ${city}` : ""}`.trim() || baseText.slice(0, 80);
    const shortDescText = baseText.slice(0, 160);
    const descText = `${baseText}. Spacious layout and practical floor plan.`;
    const displayAddressText = [input.extractedFacts.district, city].filter(Boolean).join(", ");

    const title = { ...createEmptyLocalizedString(), ...fillAllLocales(titleText) };
    const description = { ...createEmptyLocalizedText(), ...fillAllLocales(descText) };
    const shortDescription = { ...createEmptyLocalizedText(), ...fillAllLocales(shortDescText) };
    const displayAddress = { ...createEmptyLocalizedString(), ...fillAllLocales(displayAddressText) };
    const metaTitleText = `${titleText} — ${dealStatus === "sale" ? "For Sale" : dealStatus === "rent" ? "For Rent" : "Short-term Rental"}`;
    const metaDescText = shortDescText;

    const draft = {
      status: "draft" as const,
      title,
      shortDescription,
      description,
      ...(typeof price === "number" ? { price } : {}),
      dealStatus,
      ...(propertyType && dealStatus && area !== undefined
        ? {
            facts: {
              propertyType,
              area,
              ...(input.extractedFacts.bedrooms !== undefined ? { bedrooms: input.extractedFacts.bedrooms } : {}),
              ...(input.extractedFacts.bathrooms !== undefined ? { bathrooms: input.extractedFacts.bathrooms } : {}),
              ...(input.extractedFacts.yearBuilt !== undefined ? { yearBuilt: input.extractedFacts.yearBuilt } : {}),
            },
          }
        : {}),
      ...(city
        ? {
            address: {
              city,
              ...(input.extractedFacts.district ? { district: input.extractedFacts.district } : {}),
              ...(input.extractedFacts.streetLine ? { streetLine: input.extractedFacts.streetLine } : {}),
              ...(input.extractedFacts.postalCode ? { postalCode: input.extractedFacts.postalCode } : {}),
              displayAddress,
              hideExactLocation: true,
            },
          }
        : {}),
      ...(input.extractedFacts.sanityCityRef ? { sanityCityRef: input.extractedFacts.sanityCityRef } : {}),
      ...(input.extractedFacts.sanityDistrictRef ? { sanityDistrictRef: input.extractedFacts.sanityDistrictRef } : {}),
      ...(input.extractedFacts.sanityPropertyTypeRef
        ? { sanityPropertyTypeRef: input.extractedFacts.sanityPropertyTypeRef }
        : {}),
      propertyOffers: [],
      amenities: [],
      locationTags: [],
      seo: {
        metaTitle: { ...createEmptyLocalizedString(), ...fillAllLocales(metaTitleText) },
        metaDescription: { ...createEmptyLocalizedText(), ...fillAllLocales(metaDescText) },
      },
      ai: {
        provider: "stub",
        model: "stub",
        confidence: 0.35,
        warnings: ["Stub generator used — set DRAFT_PROVIDER=openai for real AI generation"],
        rawExtractedFacts: input.extractedFacts,
        generatedAt: new Date().toISOString(),
      },
    };

    return listingDraftSchema.parse(draft);
  }
}
