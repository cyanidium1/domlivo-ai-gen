import type { ListingDraft } from "@/lib/validation/listing-session";

import { createEmptyLocalizedString, createEmptyLocalizedText } from "@/lib/validation/property-i18n";

import type { ExtractedFacts } from "@/lib/validation/extracted-facts";



function factArea(f: ExtractedFacts | null | undefined): number | undefined {

  return f?.area ?? f?.areaTotal;

}



export type DraftForm = {

  internalRef: string;

  status: "draft" | "in_review" | "published" | "archived";

  titleEn: string;

  slug: string;

  shortDescriptionEn: string;

  descriptionEn: string;

  priceAmount: string;

  propertyType: string;

  dealStatus: "sale" | "rent" | "short-term";

  area: string;

  bedrooms: string;

  bathrooms: string;

  countryCode: string;

  city: string;

  district: string;

  displayAddressEn: string;

};



export const emptyDraftForm: DraftForm = {

  internalRef: "",

  status: "draft",

  titleEn: "",

  slug: "",

  shortDescriptionEn: "",

  descriptionEn: "",

  priceAmount: "",

  propertyType: "",

  dealStatus: "sale",

  area: "",

  bedrooms: "",

  bathrooms: "",

  countryCode: "",

  city: "",

  district: "",

  displayAddressEn: "",

};



export function toDraftForm(draft: ListingDraft | null | undefined): DraftForm {

  if (!draft) return emptyDraftForm;



  const price =

    typeof draft.price === "number"

      ? draft.price

      : draft.price && typeof draft.price === "object" && "amount" in draft.price

        ? (draft.price as { amount?: number }).amount

        : undefined;



  return {

    internalRef: draft.internalRef ?? "",

    status: draft.status ?? "draft",

    titleEn: draft.title?.en ?? "",

    slug: draft.slug?.current ?? "",

    shortDescriptionEn: draft.shortDescription?.en ?? "",

    descriptionEn: draft.description?.en ?? "",

    priceAmount: price !== undefined && Number.isFinite(price) ? String(price) : "",

    propertyType: draft.facts?.propertyType ?? "",

    dealStatus: draft.dealStatus ?? "sale",

    area: draft.facts?.area !== undefined ? String(draft.facts.area) : "",

    bedrooms: String(draft.facts?.bedrooms ?? ""),

    bathrooms: String(draft.facts?.bathrooms ?? ""),

    countryCode: draft.address?.countryCode ?? "",

    city: draft.address?.city ?? "",

    district: draft.address?.district ?? "",

    displayAddressEn: draft.address?.displayAddress?.en ?? "",

  };

}



function toNumber(value: string): number | undefined {

  if (!value.trim()) return undefined;

  const n = Number(value);

  return Number.isFinite(n) ? n : undefined;

}



function slugify(value: string): string {

  return value

    .trim()

    .toLowerCase()

    .replace(/[^a-z0-9\s-]/g, "")

    .replace(/\s+/g, "-")

    .replace(/-+/g, "-")

    .replace(/^-|-$/g, "");

}



export function createBaseDraftFromFacts(sessionId: string, facts?: ExtractedFacts | null): ListingDraft {

  const title = createEmptyLocalizedString();

  const description = createEmptyLocalizedText();

  const shortDescription = createEmptyLocalizedText();

  const fallbackTitle = [facts?.propertyType, facts?.city].filter(Boolean).join(" in ").trim();

  if (fallbackTitle) title.en = fallbackTitle;



  const area = factArea(facts);

  const dealStatus = facts?.dealStatus;



  const hasPrice = typeof facts?.price === "number";

  const hasFactsCore =

    typeof facts?.propertyType === "string" &&

    facts.propertyType.trim().length > 0 &&

    typeof dealStatus === "string" &&

    typeof area === "number";

  const hasAddressCore = typeof facts?.city === "string" && facts.city.trim().length > 0;



  return {

    internalRef: `LS-${sessionId.slice(0, 8).toUpperCase()}`,

    status: "draft",

    title,

    slug: {

      current: slugify(fallbackTitle || `listing-${sessionId.slice(0, 8)}`),

    },

    shortDescription,

    description,

    price: hasPrice ? facts!.price! : undefined,

    dealStatus,

    facts: hasFactsCore

      ? {

          propertyType: facts!.propertyType as string,

          area: area!,

          ...(facts?.bedrooms !== undefined ? { bedrooms: facts.bedrooms } : {}),

          ...(facts?.bathrooms !== undefined ? { bathrooms: facts.bathrooms } : {}),

          ...(facts?.yearBuilt !== undefined ? { yearBuilt: facts.yearBuilt } : {}),

        }

      : undefined,

    address: hasAddressCore

      ? {

          countryCode: "AL",

          city: facts!.city!.trim(),

          ...(facts?.district ? { district: facts.district } : {}),

          ...(facts?.streetLine ? { streetLine: facts.streetLine } : {}),

          ...(facts?.postalCode ? { postalCode: facts.postalCode } : {}),

          displayAddress: facts?.displayAddress?.trim()

            ? { ...createEmptyLocalizedString(), en: facts.displayAddress.trim() }

            : createEmptyLocalizedString(),

          hideExactLocation: true,

        }

      : undefined,

    ...(facts?.sanityCityRef ? { sanityCityRef: facts.sanityCityRef } : {}),

    ...(facts?.sanityDistrictRef ? { sanityDistrictRef: facts.sanityDistrictRef } : {}),

    ...(facts?.sanityPropertyTypeRef ? { sanityPropertyTypeRef: facts.sanityPropertyTypeRef } : {}),

    amenities: [],

    locationTags: [],

    propertyOffers: [],

    gallery: [],

    seo: {

      noIndex: false,

    },

    ai: {

      rawExtractedFacts: (facts ?? {}) as Record<string, unknown>,

      generatedAt: new Date().toISOString(),

    },

    sourceSessionId: sessionId,

  };

}



export function toListingDraft(form: DraftForm, base: ListingDraft): ListingDraft {

  const title = { ...(base.title ?? createEmptyLocalizedString()), en: form.titleEn || base.title?.en };

  const shortDescription = {

    ...(base.shortDescription ?? createEmptyLocalizedText()),

    en: form.shortDescriptionEn || base.shortDescription?.en,

  };

  const description = { ...(base.description ?? createEmptyLocalizedText()), en: form.descriptionEn || base.description?.en };

  const displayAddress = {

    ...(base.address?.displayAddress ?? createEmptyLocalizedString()),

    ...(form.displayAddressEn.trim() ? { en: form.displayAddressEn.trim() } : {}),

  };

  const amount = toNumber(form.priceAmount);

  const area = toNumber(form.area);

  const bedrooms = toNumber(form.bedrooms);

  const bathrooms = toNumber(form.bathrooms);

  const nextPropertyType = form.propertyType.trim();

  const propertyTypeResolved = nextPropertyType || base.facts?.propertyType;



  return {

    ...base,

    internalRef: form.internalRef || base.internalRef,

    status: form.status,

    title,

    slug: {

      current: form.slug || base.slug?.current || slugify(form.titleEn || title.en || ""),

    },

    shortDescription,

    description,

    price: amount !== undefined ? amount : base.price,

    dealStatus: form.dealStatus,

    facts:

      area !== undefined && propertyTypeResolved

        ? {

            ...(base.facts ?? {}),

            propertyType: propertyTypeResolved,

            area,

            ...(bedrooms !== undefined ? { bedrooms } : {}),

            ...(bathrooms !== undefined ? { bathrooms } : {}),

          }

        : base.facts,

    address:

      form.city.trim().length > 0

        ? {

            ...(base.address ?? {

              countryCode: "AL",

              displayAddress: createEmptyLocalizedString(),

              hideExactLocation: true,

            }),

            countryCode: form.countryCode.trim().length === 2 ? form.countryCode.trim().toUpperCase() : "AL",

            city: form.city.trim(),

            district: form.district.trim() || base.address?.district,

            displayAddress,

            hideExactLocation: base.address?.hideExactLocation ?? true,

          }

        : base.address,

    sourceSessionId: base.sourceSessionId,

  };

}


